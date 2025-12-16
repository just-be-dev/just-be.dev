// @ts-check

import { fileURLToPath } from "node:url";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import UnoCSS from "@unocss/astro";
import remarkMdc from "remark-mdc";
import { remarkMdcToMdx } from "./src/plugins/remark-mdc-to-mdx.ts";
import cloudflare from "@astrojs/cloudflare";

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
      remarkPlugins: [remarkMdc, remarkMdcToMdx],
    }),
    sitemap(),
    UnoCSS({ injectReset: true }),
  ],
  vite: {
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
