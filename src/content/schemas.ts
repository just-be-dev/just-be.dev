import { z } from "astro:content";

export const blogSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  code: z.string().optional(),
  slugs: z.array(z.string()).optional(),
});

export const projectsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  url: z.string().url().optional(),
  repository: z.string().url().optional(),
  status: z.enum(["active", "completed", "archived", "maintenance"]).default("active"),
  date: z.coerce.date(),
  code: z.string().optional(),
  slugs: z.array(z.string()).optional(),
});

export const researchSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  date: z.coerce.date().optional(),
  lastUpdated: z.coerce.date().optional(),
  status: z.enum(["draft", "working", "final", "archived"]).default("draft"),
  tags: z.array(z.string()).default([]),
  code: z.string().optional(),
  slugs: z.array(z.string()).optional(),
});

export const talksSchema = z.object({
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
});

export const pagesSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

export const assetsSchema = z.object({
  hash: z.string(),
  size: z.number(),
  ext: z.string(),
});

export const urlsSchema = z.object({
  code: z.string(),
});

export const redirectsSchema = z.object({
  to: z.string().url(),
  permanent: z.boolean(),
});

// Schema for the redirects YAML file structure
export const redirectsFileSchema = z.object({
  redirects: z.array(
    z.object({
      from: z.string().startsWith("/"),
      to: z.string().url(),
      permanent: z.boolean().optional(),
    })
  ),
});
