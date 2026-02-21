import { drizzle } from "drizzle-orm/d1";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Re-define the schema locally for the CLI
export const microPosts = sqliteTable("micro_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  content: text("content", { length: 280 }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
  syndicatedTo: text("syndicated_to", { mode: "json" })
    .$type<string[]>()
    .default(sql`'[]'`),
});

export async function getD1Database() {
  // Use wrangler to get local D1 access
  // Find the project root (where wrangler.toml is)
  const projectRoot = import.meta.dir + "/../../..";

  const { getPlatformProxy } = await import("wrangler");
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
