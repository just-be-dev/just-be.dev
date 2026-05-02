interface Post {
  id: number;
  content: string;
  createdAt: string;
  syndicatedTo: Array<{ platform: string; id: string; url: string }>;
}

function getSecret(): string {
  const secret = process.env.MICRO_SECRET;
  if (!secret) {
    console.error("Error: MICRO_SECRET environment variable not set");
    process.exit(1);
  }
  return secret;
}

export async function list(siteUrl: string) {
  const secret = getSecret();

  const res = await fetch(`${siteUrl}/micro`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);

  const posts = (await res.json()) as Post[];

  if (posts.length === 0) {
    console.log("no posts yet");
    return;
  }

  for (const post of posts) {
    const date = new Date(post.createdAt).toLocaleDateString();
    console.log(`[${post.id}] ${date}  ${post.content}`);
    if (post.syndicatedTo.length > 0) {
      console.log(`       syndicated: ${post.syndicatedTo.map((s) => s.platform).join(", ")}`);
    }
  }
}

export async function deletePost(id: number, siteUrl: string) {
  const secret = getSecret();

  const res = await fetch(`${siteUrl}/micro/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${secret}` },
  });

  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);

  console.log(`deleted #${id}`);
}
