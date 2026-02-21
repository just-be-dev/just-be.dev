import * as p from "@clack/prompts";
import { desc, eq } from "drizzle-orm";
import { getD1Database, microPosts } from "./db.ts";

type Post = typeof microPosts.$inferSelect;

export async function browse() {
  p.intro("Micro Blog Browser");

  const spinner = p.spinner();
  spinner.start("Loading posts...");

  try {
    const { db, dispose } = await getD1Database();

    // Fetch all posts, newest first
    const posts = await db.select().from(microPosts).orderBy(desc(microPosts.createdAt));

    spinner.stop(`Found ${posts.length} post(s)`);

    if (posts.length === 0) {
      p.note("No posts yet. Create one with 'micro post'", "Empty");
      await dispose();
      return;
    }

    // Show posts in a loop until user exits
    let shouldContinue = true;

    while (shouldContinue) {
      const options = posts.map((post) => {
        const preview =
          post.content.length > 60 ? post.content.substring(0, 60) + "..." : post.content;
        const date = post.createdAt.toLocaleDateString();
        return {
          value: post.id,
          label: `[${post.id}] ${preview}`,
          hint: date,
        };
      });

      options.push({
        value: -1,
        label: "Exit",
        hint: "",
      });

      const selectedId = await p.select({
        message: "Select a post to view options",
        options,
      });

      if (p.isCancel(selectedId) || selectedId === -1) {
        shouldContinue = false;
        continue;
      }

      const selectedPost = posts.find((p) => p.id === selectedId);
      if (!selectedPost) continue;

      // Show post details and actions
      await showPostActions(db, selectedPost, posts);
    }

    await dispose();
    p.outro("Goodbye!");
  } catch (error) {
    spinner.stop("Failed to load posts");
    throw error;
  }
}

async function showPostActions(
  db: ReturnType<typeof getD1Database> extends Promise<{ db: infer D }> ? D : never,
  post: Post,
  allPosts: Post[],
) {
  const syndicatedData =
    (post.syndicatedTo as Array<{ platform: string; id: string; url: string }> | null) || [];
  const syndicatedPlatforms = syndicatedData.map((s) => s.platform);
  const syndicatedText = syndicatedPlatforms.length > 0 ? syndicatedPlatforms.join(", ") : "None";

  p.note(
    `${post.content}\n\nCreated: ${post.createdAt.toLocaleString()}\nSyndicated to: ${syndicatedText}`,
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
      // Open in browser - construct URL based on post ID
      const url = `https://just-be.dev/micro#post-${post.id}`;
      console.log(`Opening: ${url}`);
      await Bun.spawn(["open", url]);
      break;
    }
    case "open-bluesky": {
      const blueskyData = syndicatedData.find((s) => s.platform === "bluesky");
      if (!blueskyData) {
        p.note("This post hasn't been syndicated to Bluesky yet", "Not available");
        break;
      }
      console.log(`Opening: ${blueskyData.url}`);
      await Bun.spawn(["open", blueskyData.url]);
      break;
    }
    case "open-twitter": {
      const twitterData = syndicatedData.find((s) => s.platform === "twitter");
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

      await db.delete(microPosts).where(eq(microPosts.id, post.id));

      // Remove from the posts array
      const index = allPosts.findIndex((p) => p.id === post.id);
      if (index > -1) {
        allPosts.splice(index, 1);
      }

      spinner.stop(`Post #${post.id} deleted successfully`);
      break;
    }
  }
}
