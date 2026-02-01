/**
 * Remark plugin that transforms MDC (Markdown Components) AST nodes
 * into MDX-compatible JSX AST nodes.
 *
 * This allows you to use Nuxt Content's MDC syntax in Astro with MDX.
 *
 * MDC syntax examples:
 *   ::card           → <Card>
 *   :icon            → <Icon />
 *   [text]{.class}   → <span class="class">text</span>
 *   #slot-name       → slot="slot-name"
 */

import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Parent, Root, RootContent } from "mdast";
import type { MdxJsxAttribute, MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import type { MdxjsEsm } from "mdast-util-mdxjs-esm";

// Get the components directory path
const __dirname = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(__dirname, "../components");

// Read available components from the filesystem
function getAvailableComponents(): Set<string> {
  const components = new Set<string>();
  try {
    const files = readdirSync(componentsDir);
    for (const file of files) {
      // Extract component name from filename (e.g., "Date.astro" -> "Date")
      const match = file.match(/^([A-Z][^.]+)\.astro$/);
      if (match) {
        components.add(match[1]);
      }
    }
  } catch (error) {
    console.warn("[MDC] Could not read components directory:", error);
  }
  return components;
}

const AVAILABLE_COMPONENTS = getAvailableComponents();

// MDC node types produced by remark-mdc
interface MdcAttributes {
  class?: string;
  id?: string;
  [key: string]: string | number | boolean | object | undefined;
}

interface MdcComponentNode extends Parent {
  type: "containerComponent" | "leafComponent" | "textComponent";
  name: string;
  attributes?: MdcAttributes;
  fmAttributes?: Record<string, unknown>;
  children: RootContent[];
}

interface ComponentContainerSection extends Parent {
  type: "componentContainerSection";
  name: string;
  children: RootContent[];
}

/**
 * Convert kebab-case or snake_case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Convert MDC attributes to MDX JSX attributes
 */
function convertAttributes(
  attrs: MdcAttributes | undefined,
  fmAttrs: Record<string, unknown> | undefined
): MdxJsxAttribute[] {
  const result: MdxJsxAttribute[] = [];

  // Handle inline attributes like {key="value" .class #id}
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined) continue;

      // Check if this is a bound attribute (starts with :)
      const isBound = key.startsWith(":");
      const attrName = isBound ? key.slice(1) : key;

      // Handle boolean attributes (no value)
      if (value === true) {
        result.push({
          type: "mdxJsxAttribute",
          name: attrName,
          value: null,
        });
        continue;
      }

      // Handle string values
      if (typeof value === "string") {
        // If attribute name starts with :, treat value as expression
        if (isBound) {
          // Build ESTree expression for member access (e.g., frontmatter.defs.legal_engineer)
          // Prepend "frontmatter." to the value
          const fullPath = `frontmatter.${value}`;
          const parts = fullPath.split(".");
          let expression: any;

          // Start with frontmatter as the root
          expression = {
            type: "Identifier",
            name: parts[0],
          };

          // Build the member expression chain
          for (let i = 1; i < parts.length; i++) {
            expression = {
              type: "MemberExpression",
              object: expression,
              property: {
                type: "Identifier",
                name: parts[i],
              },
              computed: false,
              optional: false,
            };
          }

          const attrValue = {
            type: "mdxJsxAttributeValueExpression",
            value: fullPath,
            data: {
              estree: {
                type: "Program",
                body: [
                  {
                    type: "ExpressionStatement",
                    expression: expression,
                  },
                ],
                sourceType: "module",
              },
            },
          };
          result.push({
            type: "mdxJsxAttribute",
            name: attrName,
            value: attrValue,
          } as MdxJsxAttribute);
        } else {
          result.push({
            type: "mdxJsxAttribute",
            name: attrName,
            value: value,
          });
        }
        continue;
      }

      // Handle bound attributes (objects/arrays as JSON)
      if (typeof value === "object") {
        result.push({
          type: "mdxJsxAttribute",
          name: key,
          value: {
            type: "mdxJsxAttributeValueExpression",
            value: JSON.stringify(value),
          },
        } as MdxJsxAttribute);
        continue;
      }

      // Handle numbers
      if (typeof value === "number") {
        result.push({
          type: "mdxJsxAttribute",
          name: key,
          value: {
            type: "mdxJsxAttributeValueExpression",
            value: String(value),
          },
        } as MdxJsxAttribute);
      }
    }
  }

  // Handle YAML frontmatter attributes (from --- block inside component)
  if (fmAttrs) {
    for (const [key, value] of Object.entries(fmAttrs)) {
      if (value === undefined) continue;

      if (typeof value === "string") {
        result.push({
          type: "mdxJsxAttribute",
          name: key,
          value: value,
        });
      } else if (typeof value === "boolean" && value === true) {
        result.push({
          type: "mdxJsxAttribute",
          name: key,
          value: null,
        });
      } else {
        result.push({
          type: "mdxJsxAttribute",
          name: key,
          value: {
            type: "mdxJsxAttributeValueExpression",
            value: JSON.stringify(value),
          },
        } as MdxJsxAttribute);
      }
    }
  }

  return result;
}

/**
 * Check if a node is an MDC component node
 */
function isMdcComponentNode(node: any): node is MdcComponentNode {
  return (
    node.type === "containerComponent" ||
    node.type === "leafComponent" ||
    node.type === "textComponent"
  );
}

/**
 * Check if a node is a slot section
 */
function isSlotSection(node: any): node is ComponentContainerSection {
  return node.type === "componentContainerSection";
}

/**
 * Recursively transform an MDC node to MDX JSX
 */
function transformNode(node: any, components: Set<string>): any {
  // First, recursively transform all children
  if (node.children && Array.isArray(node.children)) {
    node.children = node.children.map((child) => transformNode(child, components));
  }

  // Handle slot sections - wrap in a div with slot attribute
  if (isSlotSection(node)) {
    const slotElement: MdxJsxFlowElement = {
      type: "mdxJsxFlowElement",
      name: "div",
      attributes: [
        {
          type: "mdxJsxAttribute",
          name: "slot",
          value: node.name,
        },
      ],
      children: node.children as any,
    };
    return slotElement;
  }

  // Handle MDC components
  if (isMdcComponentNode(node)) {
    // Convert to PascalCase to check against available components
    const pascalCaseName = toPascalCase(node.name);

    // Check if this component exists in the components directory
    const isCustomComponent = AVAILABLE_COMPONENTS.has(pascalCaseName);
    const componentName = isCustomComponent ? pascalCaseName : node.name.toLowerCase();
    const attributes = convertAttributes(node.attributes, node.fmAttributes);

    // Track component for import generation (only custom components)
    if (isCustomComponent) {
      components.add(componentName);
    }

    // Determine if block or inline
    const isBlock = node.type === "containerComponent" || node.type === "leafComponent";

    if (isBlock) {
      const flowElement: MdxJsxFlowElement = {
        type: "mdxJsxFlowElement",
        name: componentName,
        attributes,
        children: node.children as any,
      };
      return flowElement;
    } else {
      const textElement: MdxJsxTextElement = {
        type: "mdxJsxTextElement",
        name: componentName,
        attributes,
        children: node.children as any,
      };
      return textElement;
    }
  }

  return node;
}

/**
 * Extract component names from existing import statements
 */
function getExistingImports(tree: Root): Set<string> {
  const existingImports = new Set<string>();

  for (const child of tree.children) {
    if (child.type === "mdxjsEsm") {
      const node = child as MdxjsEsm;
      // Match default imports: import ComponentName from '...'
      const defaultImportMatch = node.value.match(/import\s+(\w+)\s+from\s+['"].*['"]/g);
      if (defaultImportMatch) {
        for (const match of defaultImportMatch) {
          const componentName = match.match(/import\s+(\w+)/)?.[1];
          if (componentName) {
            existingImports.add(componentName);
          }
        }
      }
    }
  }

  return existingImports;
}

/**
 * Generate import nodes for components
 */
function generateImportNodes(components: Set<string>): MdxjsEsm[] {
  return Array.from(components)
    .sort() // Sort alphabetically for consistent output
    .map((componentName) => ({
      type: "mdxjsEsm" as const,
      value: `import ${componentName} from '@/components/${componentName}.astro'`,
      data: {
        estree: {
          type: "Program",
          body: [
            {
              type: "ImportDeclaration",
              specifiers: [
                {
                  type: "ImportDefaultSpecifier",
                  local: { type: "Identifier", name: componentName },
                },
              ],
              source: {
                type: "Literal",
                value: `@/components/${componentName}.astro`,
                raw: `'@/components/${componentName}.astro'`,
              },
            },
          ],
          sourceType: "module",
        },
      },
    }));
}

/**
 * The main remark plugin
 */
export function remarkMdcToMdx() {
  return (tree: Root, _file: any) => {
    // Track components used in the document
    const components = new Set<string>();

    // Use a simpler approach: recursively transform the entire tree
    if (tree.children) {
      tree.children = tree.children.map((child) => transformNode(child, components)) as any;
    }

    // Check for existing imports
    const existingImports = getExistingImports(tree);

    // Filter out components that are already imported
    const componentsToImport = new Set(
      Array.from(components).filter((comp) => !existingImports.has(comp))
    );

    // Generate and insert import nodes at the beginning of the tree
    if (componentsToImport.size > 0) {
      const importNodes = generateImportNodes(componentsToImport);

      // Find the position after existing imports
      let insertIndex = 0;
      for (let i = 0; i < tree.children.length; i++) {
        if (tree.children[i].type === "mdxjsEsm") {
          insertIndex = i + 1;
        } else {
          break;
        }
      }

      // Insert the new import nodes
      tree.children.splice(insertIndex, 0, ...(importNodes as any));
    }
  };
}

export default remarkMdcToMdx;
