/**
 * Satteri plugin that transforms mermaid code blocks into ASCII diagrams.
 */

import { renderMermaidAscii } from "beautiful-mermaid";
import { defineMdastPlugin } from "satteri";
import type { Code } from "mdast";

function transformMermaidCode(node: Readonly<Code>): Code {
  try {
    return {
      ...node,
      lang: "text",
      meta: null,
      // Force plain text. The default ("auto") emits ANSI color codes when
      // the build runs in a color-capable terminal, which leak into the HTML.
      value: renderMermaidAscii(node.value, {
        colorMode: "none",
      }),
    };
  } catch (error) {
    console.error("[satteri-mermaid-ascii] Failed to render mermaid diagram:", error);

    return {
      ...node,
      lang: "text",
      meta: null,
      value: `Mermaid diagram (render failed):\n${node.value}`,
    };
  }
}

export function satteriMermaidAscii() {
  return defineMdastPlugin({
    name: "satteri-mermaid-ascii",
    code: (node) => {
      if (node.lang !== "mermaid") return;
      return transformMermaidCode(node);
    },
  });
}

export default satteriMermaidAscii;
