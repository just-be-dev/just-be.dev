import type { Loader } from "astro/loaders";
import { getMicroPosts } from "@just-be/micro/loader-db";

interface MicroLoaderOptions {
  databaseId: string;
  accountId: string;
  apiToken: string;
}

export function microLoader(options: MicroLoaderOptions): Loader {
  return {
    name: "micro-loader",
    load: async ({ store, logger }) => {
      logger.info("Loading micro posts from D1");

      if (!options.databaseId || !options.accountId || !options.apiToken) {
        logger.warn(
          "Skipping micro posts: Missing D1 credentials (D1_DATABASE_ID, CLOUDFLARE_ACCOUNT_ID, or CLOUDFLARE_API_TOKEN)",
        );
        return;
      }

      try {
        const posts = await getMicroPosts({
          accountId: options.accountId,
          databaseId: options.databaseId,
          apiToken: options.apiToken,
        });

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
        logger.error(
          `Failed to load micro posts: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
  };
}
