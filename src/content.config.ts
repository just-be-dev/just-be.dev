import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { feedLoader } from "@ascorbic/feed-loader";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
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
  }),
});

const research = defineCollection({
  loader: glob({ base: "./src/content/research", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    lastUpdated: z.coerce.date().optional(),
    status: z.enum(["draft", "published", "archived"]).default("draft"),
    topics: z.array(z.string()).default([]),
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

export const collections = { blog, projects, research, pages, devtools };
