/**
 * Satteri plugin that transforms MDC-style directives into MDX JSX nodes.
 *
 * Supported syntax examples:
 * - :::callout{type="tip"} -> <Callout type="tip">
 * - ::date[Aug '25] -> <Date>Aug '25</Date>
 * - :def[legal]{:title=defs.legal_engineer} -> <Def title={frontmatter.defs.legal_engineer}>legal</Def>
 */

import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defineMdastPlugin,
  type ContainerDirective,
  type DirectiveAttributes,
  type LeafDirective,
  type MdastNode,
  type MdastVisitorContext,
  type MdxJsxAttributeNode,
  type MdxJsxAttributeUnion,
  type MdxJsxFlowElement,
  type MdxJsxTextElement,
  type MdxjsEsm,
  type TextDirective,
} from "satteri";
import type { Parents, Root } from "mdast";

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(__dirname, "../components");

function getAvailableComponents(): Set<string> {
  const components = new Set<string>();

  try {
    const files = readdirSync(componentsDir);
    for (const file of files) {
      if (file.endsWith(".astro")) {
        components.add(file.replace(/\.astro$/, ""));
      }
    }
  } catch (error) {
    console.warn("[satteri-mdc-to-mdx] Could not read components directory:", error);
  }

  return components;
}

const AVAILABLE_COMPONENTS = getAvailableComponents();

type DirectiveNode = ContainerDirective | LeafDirective | TextDirective;

type PluginState = {
  importedComponentsByRoot: WeakMap<Readonly<Root>, Set<string>>;
};

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function getRoot(node: Readonly<MdastNode>, ctx: MdastVisitorContext): Readonly<Root> | undefined {
  let current: Readonly<MdastNode> = node;
  let parent: Readonly<Parents> | undefined = ctx.parent(current);

  while (parent) {
    current = parent;
    parent = ctx.parent(current);
  }

  return current.type === "root" ? (current as Readonly<Root>) : undefined;
}

function existingComponentImports(root: Readonly<Root>): Set<string> {
  const imports = new Set<string>();

  for (const child of root.children as readonly MdastNode[]) {
    if (child.type !== "mdxjsEsm") continue;

    const value = child.value;
    for (const component of AVAILABLE_COMPONENTS) {
      const importPattern = new RegExp(
        `import\\s+${component}\\s+from\\s+["']@/components/${component}\\.astro["']`,
      );
      if (importPattern.test(value)) {
        imports.add(component);
      }
    }
  }

  return imports;
}

function createImportNode(componentName: string): MdxjsEsm {
  return {
    type: "mdxjsEsm",
    value: `import ${componentName} from "@/components/${componentName}.astro";`,
  };
}

function ensureComponentImport(
  componentName: string,
  node: Readonly<MdastNode>,
  ctx: MdastVisitorContext,
  state: PluginState,
): void {
  const root = getRoot(node, ctx);
  if (!root) return;

  let importedComponents = state.importedComponentsByRoot.get(root);
  if (!importedComponents) {
    importedComponents = existingComponentImports(root);
    state.importedComponentsByRoot.set(root, importedComponents);
  }

  if (importedComponents.has(componentName)) return;

  ctx.prependChild(root, createImportNode(componentName));
  importedComponents.add(componentName);
}

function convertAttributes(attrs?: DirectiveAttributes): MdxJsxAttributeUnion[] {
  if (!attrs) return [];

  const result: MdxJsxAttributeUnion[] = [];

  for (const [key, rawValue] of Object.entries(attrs)) {
    const isExpression = key.startsWith(":");
    const name = isExpression ? key.slice(1) : key;

    if (!name) continue;

    if (isExpression) {
      if (rawValue == null || rawValue === "") continue;

      result.push({
        type: "mdxJsxAttribute",
        name,
        value: {
          type: "mdxJsxAttributeValueExpression",
          value: `frontmatter.${rawValue}`,
        },
      } as MdxJsxAttributeNode);
      continue;
    }

    result.push({
      type: "mdxJsxAttribute",
      name,
      value: rawValue ?? null,
    });
  }

  return result;
}

function componentNameFor(node: Readonly<DirectiveNode>): string {
  const pascalCaseName = toPascalCase(node.name);
  return AVAILABLE_COMPONENTS.has(pascalCaseName) ? pascalCaseName : node.name;
}

function transformFlowDirective(
  node: Readonly<ContainerDirective | LeafDirective>,
  ctx: MdastVisitorContext,
  state: PluginState,
): MdxJsxFlowElement {
  const componentName = componentNameFor(node);

  if (AVAILABLE_COMPONENTS.has(componentName)) {
    ensureComponentImport(componentName, node, ctx, state);
  }

  return {
    type: "mdxJsxFlowElement",
    name: componentName,
    attributes: convertAttributes(node.attributes),
    children: [...(node.children ?? [])] as MdxJsxFlowElement["children"],
  };
}

function transformTextDirective(
  node: Readonly<TextDirective>,
  ctx: MdastVisitorContext,
  state: PluginState,
): MdxJsxTextElement {
  const componentName = componentNameFor(node);

  if (AVAILABLE_COMPONENTS.has(componentName)) {
    ensureComponentImport(componentName, node, ctx, state);
  }

  return {
    type: "mdxJsxTextElement",
    name: componentName,
    attributes: convertAttributes(node.attributes),
    children: [...(node.children ?? [])] as MdxJsxTextElement["children"],
  };
}

export function satteriMdcToMdx() {
  const state: PluginState = {
    importedComponentsByRoot: new WeakMap(),
  };

  return defineMdastPlugin({
    name: "satteri-mdc-to-mdx",
    containerDirective: (node, ctx) => transformFlowDirective(node, ctx, state),
    leafDirective: (node, ctx) => transformFlowDirective(node, ctx, state),
    textDirective: (node, ctx) => transformTextDirective(node, ctx, state),
  });
}

export default satteriMdcToMdx;
