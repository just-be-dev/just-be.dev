import * as p from "@clack/prompts";

interface Post {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
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

export async function browse(siteUrl: string) {
  p.intro("Micro Blog Browser");

  const spinner = p.spinner();
  spinner.start("Loading posts...");

  const secret = getSecret();

  let posts: Post[];
  try {
    const res = await fetch(`${siteUrl}/micro`, {
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    posts = (await res.json()) as Post[];
  } catch (error) {
    spinner.stop("Failed to load posts");
    throw error;
  }

  spinner.stop(`Found ${posts.length} post(s)`);

  if (posts.length === 0) {
    p.note("No posts yet. Create one with 'micro post'", "Empty");
    return;
  }

  let shouldContinue = true;

  while (shouldContinue) {
    const options = posts.map((post) => {
      const preview =
        post.content.length > 60 ? post.content.substring(0, 60) + "..." : post.content;
      const date = new Date(post.createdAt).toLocaleDateString();
      return {
        value: post.id,
        label: `[${post.id}] ${preview}`,
        hint: date,
      };
    });

    options.push({ value: -1, label: "Exit", hint: "" });

    const selectedId = await p.select({
      message: "Select a post to view options",
      options,
    });

    if (p.isCancel(selectedId) || selectedId === -1) {
      shouldContinue = false;
      continue;
    }

    const selectedPost = posts.find((post) => post.id === selectedId);
    if (!selectedPost) continue;

    await showPostActions({ siteUrl, secret }, selectedPost, posts);
  }

  p.outro("Goodbye!");
}

async function showPostActions(
  config: { siteUrl: string; secret: string },
  post: Post,
  allPosts: Post[],
) {
  const syndicatedPlatforms = post.syndicatedTo.map((s) => s.platform);
  const syndicatedText = syndicatedPlatforms.length > 0 ? syndicatedPlatforms.join(", ") : "None";

  p.note(
    `${post.content}\n\nCreated: ${new Date(post.createdAt).toLocaleString()}\nSyndicated to: ${syndicatedText}`,
    `Post #${post.id}`,
  );

  const action = await p.select({
    message: "What would you like to do?",
    options: [
      { value: "open-web", label: "Open on website" },
      {
        value: "open-bluesky",
        label: "Open on Bluesky",
        hint: syndicatedPlatforms.includes("bluesky") ? "✓" : "Not syndicated",
      },
      {
        value: "open-twitter",
        label: "Open on Twitter/X",
        hint: syndicatedPlatforms.includes("twitter") ? "✓" : "Not syndicated",
      },
      { value: "delete", label: "Delete post" },
      { value: "back", label: "Back to list" },
    ],
  });

  if (p.isCancel(action) || action === "back") {
    return;
  }

  switch (action) {
    case "open-web": {
      const url = `${config.siteUrl}/micro#${post.id}`;
      console.log(`Opening: ${url}`);
      await Bun.spawn(["open", url]);
      break;
    }
    case "open-bluesky": {
      const blueskyData = post.syndicatedTo.find((s) => s.platform === "bluesky");
      if (!blueskyData) {
        p.note("This post hasn't been syndicated to Bluesky yet", "Not available");
        break;
      }
      console.log(`Opening: ${blueskyData.url}`);
      await Bun.spawn(["open", blueskyData.url]);
      break;
    }
    case "open-twitter": {
      const twitterData = post.syndicatedTo.find((s) => s.platform === "twitter");
      if (!twitterData) {
        p.note("This post hasn't been syndicated to Twitter yet", "Not available");
        break;
      }
      console.log(`Opening: ${twitterData.url}`);
      await Bun.spawn(["open", twitterData.url]);
      break;
    }
    case "delete": {
      const confirmed = await p.confirm({
        message: `Are you sure you want to delete post #${post.id}?`,
        initialValue: false,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.note("Delete cancelled", "Cancelled");
        break;
      }

      const spinner = p.spinner();
      spinner.start("Deleting post...");

      const res = await fetch(`${config.siteUrl}/micro/${post.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${config.secret}` },
      });

      if (!res.ok) {
        spinner.stop("Delete failed");
        p.log.warn(`Server returned ${res.status}`);
        break;
      }

      const index = allPosts.findIndex((p) => p.id === post.id);
      if (index > -1) allPosts.splice(index, 1);

      spinner.stop(`Post #${post.id} deleted successfully`);
      break;
    }
  }
}
