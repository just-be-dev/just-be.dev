const MAX_LENGTH = 280;

function getSecret(): string {
  const secret = process.env.MICRO_SECRET;
  if (!secret) {
    console.error("Error: MICRO_SECRET environment variable not set");
    process.exit(1);
  }
  return secret;
}

export async function post(content: string | undefined, siteUrl: string) {
  let postContent = content;

  if (!postContent) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    postContent = Buffer.concat(chunks).toString("utf8").trim();
  }

  if (!postContent) {
    console.error("Error: no content provided (pass as argument or pipe via stdin)");
    process.exit(1);
  }

  if (postContent.length > MAX_LENGTH) {
    console.error(`Error: too long (${postContent.length}/${MAX_LENGTH} characters)`);
    process.exit(1);
  }

  const secret = getSecret();

  const res = await fetch(`${siteUrl}/micro`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ content: postContent }),
  });

  if (!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }

  const { post: newPost, syndication } = (await res.json()) as {
    post: { id: number; content: string; createdAt: string };
    syndication: Array<{ platform: string; success: boolean; url?: string; error?: string }>;
  };

  console.log(`posted #${newPost.id}`);

  for (const s of syndication) {
    if (s.success) {
      console.log(`  ${s.platform}: ${s.url}`);
    } else {
      console.error(`  ${s.platform}: ${s.error}`);
    }
  }
}
