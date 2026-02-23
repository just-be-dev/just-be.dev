import type { Loader } from "astro/loaders";
import { getMicroPosts } from "@just-be/micro/loader-db";

export function microLoader(): Loader {
  return {
    name: "micro-loader",
    load: async ({ store, logger }) => {
      logger.info("Loading micro posts from D1");

      try {
        const posts = await getMicroPosts();

        for (const post of posts) {
          store.set({
            id: String(post.id),
            data: {
              content: post.content,
              createdAt: post.createdAt,
              updatedAt: post.updatedAt,
              syndicatedTo: (post.syndicatedTo ?? []).map((item) => item.url),
            },
          });
        }

        logger.info(`Loaded ${posts.length} micro posts`);
      } catch (error) {
        logger.warn(
          `Skipping micro posts: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };
}
