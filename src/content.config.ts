import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { feedLoader } from "@ascorbic/feed-loader";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load as loadYAML } from "js-yaml";
import {
  blogSchema,
  projectsSchema,
  researchSchema,
  talksSchema,
  pagesSchema,
  urlsSchema,
  redirectsSchema,
  redirectsFileSchema,
} from "./content/schemas";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: blogSchema,
});

const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "**/*.{md,mdx}" }),
  schema: projectsSchema,
});

const research = defineCollection({
  loader: glob({ base: "./src/content/research", pattern: "**/*.{md,mdx}" }),
  schema: researchSchema,
});

const talks = defineCollection({
  loader: glob({ base: "./src/content/talks", pattern: "**/*.{md,mdx}" }),
  schema: talksSchema,
});

const pages = defineCollection({
  loader: glob({ base: "./src/content/pages", pattern: "**/*.{md,mdx}" }),
  schema: pagesSchema,
});

const devtools = defineCollection({
  loader: feedLoader({
    url: "https://www.devtools.fm/rss.xml",
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
  schema: urlsSchema,
});

const redirects = defineCollection({
  loader: {
    name: "redirects-loader",
    load: ({ store, logger }) => {
      logger.info("Loading redirects");

      const redirectsPath = join(process.cwd(), "src/content/redirects.yaml");
      const redirectsContent = readFileSync(redirectsPath, "utf-8");
      const rawData = loadYAML(redirectsContent);
      const data = redirectsFileSchema.parse(rawData);

      // Store each redirect with its "from" path as the ID
      for (const redirect of data.redirects) {
        store.set({
          id: redirect.from,
          data: {
            to: redirect.to,
            permanent: redirect.permanent ?? false,
          },
        });
      }

      logger.info(`Loaded ${data.redirects.length} redirects`);
    },
  },
  schema: redirectsSchema,
});

export const collections = {
  blog,
  projects,
  research,
  pages,
  devtools,
  talks,
  urls,
  redirects,
};
