import type { Loader } from "astro/loaders";

interface MicroLoaderOptions {
  databaseId: string;
  accountId: string;
  apiToken: string;
}

interface MicroPost {
  id: number;
  content: string;
  created_at: number;
  updated_at: number;
  syndicated_to: string;
}

export function microLoader(options: MicroLoaderOptions): Loader {
  return {
    name: "micro-loader",
    load: async ({ store, logger }) => {
      logger.info("Loading micro posts from D1");

      // Skip loading if required credentials are missing
      if (!options.databaseId || !options.accountId || !options.apiToken) {
        logger.warn(
          "Skipping micro posts: Missing D1 credentials (D1_DATABASE_ID, CLOUDFLARE_ACCOUNT_ID, or CLOUDFLARE_API_TOKEN)",
        );
        return;
      }

      try {
        const query =
          "SELECT id, content, created_at, updated_at, syndicated_to FROM micro_posts ORDER BY created_at DESC";

        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/d1/database/${options.databaseId}/query`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${options.apiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sql: query,
            }),
          },
        );

        if (!response.ok) {
          throw new Error(`D1 API request failed: ${response.status} ${await response.text()}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(`D1 query failed: ${JSON.stringify(data.errors)}`);
        }

        const results = data.result[0]?.results || [];

        // Store each post in the collection
        for (const post of results as MicroPost[]) {
          store.set({
            id: String(post.id),
            data: {
              content: post.content,
              createdAt: new Date(post.created_at * 1000),
              updatedAt: new Date(post.updated_at * 1000),
              syndicatedTo: post.syndicated_to ? JSON.parse(post.syndicated_to) : [],
            },
          });
        }

        logger.info(`Loaded ${results.length} micro posts`);
      } catch (error) {
        logger.error(
          `Failed to load micro posts: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },
  };
}
