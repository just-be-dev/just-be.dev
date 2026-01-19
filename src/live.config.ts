import { defineLiveCollection } from "astro:content";
import { z } from "astro:content";
import { githubReadmeLoader } from "./loaders/github-readme";

const readmes = defineLiveCollection({
  loader: githubReadmeLoader(),
  schema: z.object({
    repo: z.string(),
    url: z.string().url(),
    branch: z.string(),
    owner: z.string(),
  }),
});

export const collections = { readmes };
