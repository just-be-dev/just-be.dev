import * as p from "@clack/prompts";

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
    p.intro("Create a new micro post");

    const result = await p.text({
      message: "What's on your mind?",
      placeholder: "Type your post here...",
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return "Post cannot be empty";
        }
        if (value.length > MAX_LENGTH) {
          return `Post is too long (${value.length}/${MAX_LENGTH} characters)`;
        }
      },
    });

    if (p.isCancel(result)) {
      p.cancel("Post cancelled");
      process.exit(0);
    }

    postContent = result;
  } else {
    if (postContent.length > MAX_LENGTH) {
      console.error(`Error: Post is too long (${postContent.length}/${MAX_LENGTH} characters)`);
      process.exit(1);
    }
  }

  const secret = getSecret();
  const spinner = p.spinner();
  spinner.start("Creating post...");

  try {
    const res = await fetch(`${siteUrl}/micro`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ content: postContent }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Server returned ${res.status}: ${text}`);
    }

    const { post: newPost, syndication } = (await res.json()) as {
      post: { id: number; content: string; createdAt: string };
      syndication: Array<{ platform: string; success: boolean; url?: string; error?: string }>;
    };

    spinner.stop("Post created successfully!");

    if (syndication && syndication.length > 0) {
      const successful = syndication.filter((r) => r.success);
      const failed = syndication.filter((r) => !r.success);

      if (successful.length > 0) {
        p.log.info(`Syndicated to: ${successful.map((s) => s.platform).join(", ")}`);
        for (const s of successful) {
          if (s.url) p.log.info(`  ${s.platform}: ${s.url}`);
        }
      }
      for (const f of failed) {
        p.log.warn(`${f.platform}: ${f.error}`);
      }
    }

    p.note(
      `ID: ${newPost.id}\nContent: ${newPost.content}\nCreated: ${new Date(newPost.createdAt).toLocaleString()}`,
      "Post Details",
    );
  } catch (error) {
    spinner.stop("Failed to create post");
    throw error;
  }
}
