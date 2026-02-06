/**
 * Remark plugin that transforms mermaid code blocks into beautiful ASCII art.
 *
 * Detects code blocks with language "mermaid" and converts them to ASCII
 * diagrams using beautiful-mermaid's renderMermaidAscii function.
 */

import type { Root, RootContent, Code } from "mdast";
import { renderMermaidAscii } from "beautiful-mermaid";

/**
 * Check if a node is a mermaid code block
 */
function isMermaidCodeBlock(node: any): node is Code {
  return node.type === "code" && node.lang === "mermaid";
}

/**
 * Transform a mermaid code block into ASCII art
 */
function transformMermaidCode(node: Code): Code {
  try {
    // Render the mermaid diagram as ASCII
    const ascii = renderMermaidAscii(node.value, {
      // Use Unicode box-drawing characters for better appearance
      spacing: "normal",
    });

    // Return a code block with the ASCII art
    return {
      type: "code",
      lang: "text",
      meta: null,
      value: ascii,
    };
  } catch (error) {
    console.error("[remark-mermaid-ascii] Failed to render mermaid diagram:", error);

    // Return an error message in a code block
    return {
      type: "code",
      lang: "text",
      meta: null,
      value: `Error rendering mermaid diagram:\n${error instanceof Error ? error.message : String(error)}\n\nSource:\n${node.value}`,
    };
  }
}

/**
 * Recursively process nodes in the tree
 */
function processNode(node: any): any {
  // If this is a mermaid code block, transform it
  if (isMermaidCodeBlock(node)) {
    return transformMermaidCode(node);
  }

  // Recursively process children
  if (node.children && Array.isArray(node.children)) {
    node.children = node.children.map((child) => processNode(child));
  }

  return node;
}

/**
 * The remark plugin
 */
export function remarkMermaidAscii() {
  return (tree: Root) => {
    // Process all children recursively
    tree.children = tree.children.map((child) => processNode(child)) as RootContent[];
  };
}

export default remarkMermaidAscii;
