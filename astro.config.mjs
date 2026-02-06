// @ts-check

import { fileURLToPath } from "node:url";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import UnoCSS from "@unocss/astro";
import remarkMdc from "remark-mdc";
import { remarkMdcToMdx } from "./src/plugins/remark-mdc-to-mdx.ts";
import { remarkMermaidAscii } from "./src/plugins/remark-mermaid-ascii.ts";
import cloudflare from "@astrojs/cloudflare";
import sentry from "@sentry/astro";

// https://astro.build/config
export default defineConfig({
  site: "https://just-be.dev",
  output: "static",
  adapter: cloudflare(),
  experimental: {
    liveContentCollections: true,
  },
  integrations: [
    sentry({
      dsn: process.env.PUBLIC_SENTRY_DSN,
      sourceMapsUploadOptions: {
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
      },
    }),
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
