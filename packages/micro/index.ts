#!/usr/bin/env bun

import { browse } from "./src/browse.ts";
import { post } from "./src/post.ts";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (!command) {
    // Default: browse all posts
    await browse();
  } else if (command === "post") {
    const content = args[1];
    await post(content);
  } else {
    console.error(`Unknown command: ${command}`);
    console.log("Usage:");
    console.log("  micro              - Browse all posts");
    console.log("  micro post         - Create a new post (TUI editor)");
    console.log('  micro post "text"  - Create a new post directly');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
