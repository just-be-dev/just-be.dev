import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { microPosts } from "./schema";

export interface D1HttpCredentials {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

function createD1HttpAdapter(credentials: D1HttpCredentials): D1Database {
  const url = `https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/d1/database/${credentials.databaseId}/query`;

  async function query(sql: string, params: unknown[] = []) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });

    if (!response.ok) {
      throw new Error(`D1 HTTP error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      success: boolean;
      errors: unknown[];
      result: Array<{ results: Record<string, unknown>[]; meta: unknown }>;
    };
    if (!data.success) {
      throw new Error(`D1 query error: ${JSON.stringify(data.errors)}`);
    }
    return data.result[0] ?? { results: [], meta: {} };
  }

  function stmt(sql: string, params: unknown[] = []) {
    return {
      bind: (...values: unknown[]) => stmt(sql, values),
      all: async () => {
        const result = await query(sql, params);
        return { results: result.results, success: true, meta: result.meta };
      },
      run: async () => {
        const result = await query(sql, params);
        return { results: result.results, success: true, meta: result.meta };
      },
      first: async () => {
        const result = await query(sql, params);
        return result.results[0] ?? null;
      },
      raw: async () => {
        const result = await query(sql, params);
        return result.results;
      },
    };
  }

  return {
    prepare: (sql: string) => stmt(sql) as unknown as D1PreparedStatement,
    batch: (statements: D1PreparedStatement[]) =>
      Promise.all(statements.map((s) => (s as ReturnType<typeof stmt>).all())),
    dump: () => Promise.reject(new Error("dump() not supported in HTTP mode")),
    exec: async (sql: string) => {
      const result = await query(sql);
      return { count: result.results.length, duration: 0 };
    },
  } as D1Database;
}

export function getMicroPosts(credentials: D1HttpCredentials) {
  const db = drizzle(createD1HttpAdapter(credentials), { schema: { microPosts } });
  return db.select().from(microPosts).orderBy(desc(microPosts.createdAt));
}
