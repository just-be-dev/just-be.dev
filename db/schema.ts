import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    .$type<Array<{ platform: string; id: string; url: string }>>()
    .default(sql`'[]'`),
});
