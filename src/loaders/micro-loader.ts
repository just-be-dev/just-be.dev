import type { Loader } from "astro/loaders";
import { getPlatformProxy } from "wrangler";
import { createMicroStorage } from "@/lib/micro-r2.ts";

export function microLoader(): Loader {
  return {
    name: "micro-loader",
    load: async ({ store, logger }) => {
      logger.info("Loading micro posts from R2");

      try {
        const projectRoot = import.meta.dir + "/../..";
        const { env, dispose } = await getPlatformProxy<{ MICRO_BUCKET: R2Bucket }>({
          configPath: `${projectRoot}/wrangler.toml`,
          persist: { path: `${projectRoot}/.wrangler/state/v3` },
        });

        try {
          if (!env.MICRO_BUCKET) {
            throw new Error("MICRO_BUCKET not configured in wrangler.toml");
          }

          const storage = createMicroStorage(env.MICRO_BUCKET);
          const posts = await storage.readPosts();
          posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

          for (const post of posts) {
            store.set({
              id: String(post.id),
              data: {
                content: post.content,
                createdAt: post.createdAt,
                updatedAt: post.updatedAt,
                syndicatedTo: post.syndicatedTo.map((item) => item.url),
              },
            });
          }

          logger.info(`Loaded ${posts.length} micro posts`);
        } finally {
          await dispose();
        }
      } catch (error) {
        logger.warn(
          `Skipping micro posts: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };
}
