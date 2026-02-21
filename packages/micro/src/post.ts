import * as p from "@clack/prompts";
import { eq } from "drizzle-orm";
import { getD1Database, microPosts } from "./db.ts";
import { hasSyndicationConfig, loadSyndicationConfig, syndicatePost } from "./syndicate.ts";

const MAX_LENGTH = 280;

export async function post(content?: string) {
  let postContent = content;

  // If no content provided, open TUI editor
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
    // Validate direct content
    if (postContent.length > MAX_LENGTH) {
      console.error(`Error: Post is too long (${postContent.length}/${MAX_LENGTH} characters)`);
      process.exit(1);
    }
  }

  const spinner = p.spinner();
  spinner.start("Creating post...");

  try {
    const { db, dispose } = await getD1Database();

    // Insert the post
    const result = await db
      .insert(microPosts)
      .values({
        content: postContent,
      })
      .returning();

    const post = result[0];

    if (!post) {
      throw new Error("Failed to create post");
    }

    spinner.stop("Post created successfully!");

    // Attempt syndication
    const config = loadSyndicationConfig();

    if (hasSyndicationConfig(config)) {
      spinner.start("Syndicating to social media...");

      try {
        const syndicationResults = await syndicatePost(postContent, config);

        const successfulPlatforms = syndicationResults
          .filter((r) => r.success)
          .map((r) => r.platform);

        const failedPlatforms = syndicationResults.filter((r) => !r.success);

        // Update database with successful syndications
        if (successfulPlatforms.length > 0) {
          await db
            .update(microPosts)
            .set({ syndicatedTo: successfulPlatforms })
            .where(eq(microPosts.id, post.id));
        }

        // Report results
        if (successfulPlatforms.length > 0) {
          spinner.stop(`Syndicated to: ${successfulPlatforms.join(", ")}`);
        } else {
          spinner.stop("Syndication failed");
        }

        // Show any errors
        if (failedPlatforms.length > 0) {
          for (const failure of failedPlatforms) {
            p.log.warn(`${failure.platform}: ${failure.error}`);
          }
        }

        // Show success URLs
        for (const success of syndicationResults.filter((r) => r.success)) {
          if (success.url) {
            p.log.info(`${success.platform}: ${success.url}`);
          }
        }
      } catch (error) {
        spinner.stop("Syndication failed");
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        p.log.warn(`Syndication error: ${errorMessage}`);
      }
    }

    await dispose();

    // Show post details
    p.note(
      `ID: ${post.id}\nContent: ${post.content}\nCreated: ${post.createdAt.toLocaleString()}`,
      "Post Details",
    );
  } catch (error) {
    spinner.stop("Failed to create post");
    throw error;
  }
}
