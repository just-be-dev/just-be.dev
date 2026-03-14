import { defineLiveCollection } from "astro:content";
import { z } from "astro/zod";
import { githubReadmeLoader } from "./loaders/github-readme";

const readme = defineLiveCollection({
  loader: githubReadmeLoader(),
  schema: z.object({
    repo: z.string(),
    url: z.string().url(),
    branch: z.string(),
    owner: z.string(),
  }),
});

export const collections = { readme };
