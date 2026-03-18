// @ts-check

import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import UnoCSS from "@unocss/astro";
import remarkMdc from "remark-mdc";
import { remarkMdcToMdx } from "./src/plugins/remark-mdc-to-mdx.ts";
import { remarkMermaidAscii } from "./src/plugins/remark-mermaid-ascii.ts";
import cloudflare from "@astrojs/cloudflare";
/**
 * Vite plugin that removes public/assets from the build output. These files
 * are served externally and would otherwise cause miniflare to reject the
 * build (e.g. files exceeding Cloudflare's 25 MiB asset size limit).
 */
function excludePublicAssets() {
  return {
    name: "exclude-public-assets",
    enforce: "post",
    async closeBundle() {
      const assetsDir = fileURLToPath(
        new URL("./dist/client/assets", import.meta.url),
      );
      await rm(assetsDir, { recursive: true, force: true });
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: "https://just-be.dev",
  output: "static",
  adapter: cloudflare(),
  integrations: [
    mdx({
      syntaxHighlight: "shiki",
      shikiConfig: {
        theme: "github-light",
      },
      gfm: true,
      remarkPlugins: [remarkMdc, remarkMermaidAscii, remarkMdcToMdx],
    }),
    sitemap(),
    UnoCSS(),
  ],
  vite: {
    plugins: [excludePublicAssets()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  },
  markdown: {
    shikiConfig: {
      theme: "github-dark",
    },
  },
});
