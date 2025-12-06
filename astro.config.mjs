// @ts-check

import { fileURLToPath } from "node:url";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import UnoCSS from "@unocss/astro";
import remarkMdc from "remark-mdc";
import { remarkMdcToMdx } from "./src/plugins/remark-mdc-to-mdx.ts";

// https://astro.build/config
export default defineConfig({
  site: "https://just-be.dev",
  integrations: [
    mdx({
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
