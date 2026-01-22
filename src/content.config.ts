import { defineCollection, z } from "astro:content";
import { glob, file } from "astro/loaders";
import { feedLoader } from "@ascorbic/feed-loader";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load as loadYAML } from "js-yaml";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    code: z.string().optional(),
    slugs: z.array(z.string()).optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    url: z.string().url().optional(),
    repository: z.string().url().optional(),
    status: z.enum(["active", "completed", "archived", "maintenance"]).default("active"),
    date: z.coerce.date(),
    code: z.string().optional(),
    slugs: z.array(z.string()).optional(),
  }),
});

const research = defineCollection({
  loader: glob({ base: "./src/content/research", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    lastUpdated: z.coerce.date().optional(),
    status: z.enum(["proposed", "active", "dormant", "abandoned", "concluded"]).default("proposed"),
    tags: z.array(z.string()).default([]),
    code: z.string().optional(),
    slugs: z.array(z.string()).optional(),
  }),
});

const talks = defineCollection({
  loader: glob({ base: "./src/content/talks", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    event: z.string(),
    location: z.string().optional(),
    slides: z
      .union([
        z.number(),
        z.array(
          z.object({
            image: z.string(),
            timestamp: z.union([z.number(), z.string()]).optional(),
          })
        ),
      ])
      .optional(),
    audioPath: z.string().optional(),
    transcriptPath: z.string().optional(),
    code: z.string().optional(),
    slugs: z.array(z.string()).optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ base: "./src/content/pages", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }),
});

const devtools = defineCollection({
  loader: feedLoader({
    url: "https://www.devtools.fm/rss.xml",
  }),
});

const assets = defineCollection({
  loader: {
    name: "asset-manifest-loader",
    load: ({ store, logger }) => {
      logger.info("Loading asset manifest");

      const manifestPath = join(process.cwd(), "src/content/manifest.json");
      const manifestContent = readFileSync(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestContent);

      // Transform {assets: {path: {metadata}}} to array of {id, ...metadata}
      for (const [path, metadata] of Object.entries(manifest.assets)) {
        store.set({
          id: path,
          data: metadata,
        });
      }

      logger.info(`Loaded ${Object.keys(manifest.assets).length} assets`);
    },
  },
  schema: z.object({
    hash: z.string(),
    size: z.number(),
    ext: z.string(),
  }),
});

const urls = defineCollection({
  loader: {
    name: "url-manifest-loader",
    load: ({ store, logger }) => {
      logger.info("Loading URL manifest");

      const manifestPath = join(process.cwd(), "src/content/url-manifest.yaml");
      const manifestContent = readFileSync(manifestPath, "utf-8");
      const manifest = loadYAML(manifestContent) as { codes: Record<string, string[]> };

      // Transform {codes: {code: [slugs]}} to array of {id: slug, code}
      let urlCount = 0;
      for (const [code, slugs] of Object.entries(manifest.codes)) {
        for (const slug of slugs) {
          store.set({
            id: slug,
            data: { code },
          });
          urlCount++;
        }
      }

      logger.info(`Loaded ${urlCount} URLs from ${Object.keys(manifest.codes).length} codes`);
    },
  },
  schema: z.object({
    code: z.string(),
  }),
});

export const collections = { blog, projects, research, pages, devtools, talks, assets, urls };
