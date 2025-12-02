// @ts-check

import { fileURLToPath } from "node:url";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import icon from "astro-icon";
import remarkMdc from "remark-mdc";
import { remarkMdcToMdx } from "./src/plugins/remark-mdc-to-mdx.ts";

// https://astro.build/config
export default defineConfig({
  site: "https://just-be.dev",
  integrations: [
    icon(),
    mdx({
      remarkPlugins: [remarkMdc, remarkMdcToMdx],
    }),
    sitemap(),
  ],
  vite: {
    plugins: [tailwindcss()],
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
