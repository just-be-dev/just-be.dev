export interface MicroPost {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  syndicatedTo: Array<{ platform: string; id: string; url: string }>;
}

interface D1Row {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
  syndicated_to: string;
}

function rowToPost(row: D1Row): MicroPost {
  return {
    id: row.id,
    content: row.content,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    syndicatedTo: JSON.parse(row.syndicated_to),
  };
}

export function microStore(db: D1Database) {
  async function readPosts(): Promise<MicroPost[]> {
    const { results } = await db
      .prepare("SELECT * FROM micro_posts ORDER BY created_at DESC")
      .all<D1Row>();
    return results.map(rowToPost);
  }

  async function addPost(content: string): Promise<MicroPost> {
    const now = new Date().toISOString();
    const { meta } = await db
      .prepare("INSERT INTO micro_posts (content, created_at, updated_at) VALUES (?, ?, ?)")
      .bind(content, now, now)
      .run();
    const row = await db
      .prepare("SELECT * FROM micro_posts WHERE id = ?")
      .bind(meta.last_row_id)
      .first<D1Row>();
    return rowToPost(row!);
  }

  async function updatePost(id: number, updates: Partial<MicroPost>): Promise<void> {
    const now = new Date().toISOString();
    const sets: string[] = ["updated_at = ?"];
    const binds: unknown[] = [now];

    if (updates.content !== undefined) {
      sets.push("content = ?");
      binds.push(updates.content);
    }
    if (updates.syndicatedTo !== undefined) {
      sets.push("syndicated_to = ?");
      binds.push(JSON.stringify(updates.syndicatedTo));
    }

    binds.push(id);
    const result = await db
      .prepare(`UPDATE micro_posts SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...binds)
      .run();
    if (result.meta.changes === 0) {
      throw new Error(`Post #${id} not found`);
    }
  }

  async function deletePost(id: number): Promise<void> {
    await db.prepare("DELETE FROM micro_posts WHERE id = ?").bind(id).run();
  }

  return { readPosts, addPost, updatePost, deletePost };
}
