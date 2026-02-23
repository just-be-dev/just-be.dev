export interface MicroPost {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  syndicatedTo: Array<{ platform: string; id: string; url: string }>;
}

interface RawPost {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  syndicatedTo: Array<{ platform: string; id: string; url: string }>;
}

const POSTS_KEY = "micro-posts.jsonl";

export function createMicroStorage(bucket: R2Bucket) {
  async function readPosts(): Promise<MicroPost[]> {
    const obj = await bucket.get(POSTS_KEY);
    if (!obj) return [];
    const text = await obj.text();
    return text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const raw = JSON.parse(line) as RawPost;
        return {
          ...raw,
          createdAt: new Date(raw.createdAt),
          updatedAt: new Date(raw.updatedAt),
        };
      });
  }

  async function writePosts(posts: MicroPost[]): Promise<void> {
    const lines = posts.map((p) =>
      JSON.stringify({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }),
    );
    await bucket.put(POSTS_KEY, lines.join("\n") + "\n");
  }

  async function addPost(content: string): Promise<MicroPost> {
    const posts = await readPosts();
    const maxId = posts.reduce((max, p) => Math.max(max, p.id), 0);
    const now = new Date();
    const newPost: MicroPost = {
      id: maxId + 1,
      content,
      createdAt: now,
      updatedAt: now,
      syndicatedTo: [],
    };
    posts.push(newPost);
    await writePosts(posts);
    return newPost;
  }

  async function updatePost(id: number, updates: Partial<MicroPost>): Promise<void> {
    const posts = await readPosts();
    const idx = posts.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Post #${id} not found`);
    posts[idx] = { ...posts[idx]!, ...updates, updatedAt: new Date() };
    await writePosts(posts);
  }

  async function deletePost(id: number): Promise<void> {
    const posts = await readPosts();
    await writePosts(posts.filter((p) => p.id !== id));
  }

  return { readPosts, addPost, updatePost, deletePost };
}
