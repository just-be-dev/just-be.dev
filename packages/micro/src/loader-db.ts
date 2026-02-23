import { desc } from "drizzle-orm";

import { getD1Database } from "./db";
import { microPosts } from "./schema";

export async function getMicroPosts() {
  const { db, dispose } = await getD1Database();
  try {
    return await db.select().from(microPosts).orderBy(desc(microPosts.createdAt));
  } finally {
    await dispose();
  }
}
