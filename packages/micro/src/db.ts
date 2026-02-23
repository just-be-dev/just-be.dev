import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import { microPosts } from "./schema";

export { microPosts };

export async function getD1Database() {
  // Use wrangler to get local D1 access
  // Find the project root (where wrangler.toml is)
  const projectRoot = import.meta.dir + "/../../..";
  const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>({
    configPath: `${projectRoot}/wrangler.toml`,
    persist: { path: `${projectRoot}/.wrangler/state/v3` },
  });

  if (!env.DB) {
    throw new Error("D1 database not available. Make sure wrangler.toml is configured correctly.");
  }

  const db = drizzle(env.DB, { schema: { microPosts } });

  return { db, dispose };
}
