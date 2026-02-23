#!/usr/bin/env bun

import { browse } from "./src/browse.ts";
import { post } from "./src/post.ts";

const PRODUCTION_URL = "https://just-be.dev";
const WORKER_NAME = "just-be-dev";
const WORKERS_DEV_SUBDOMAIN = "just-be";

function siteUrlFromBranch(branch: string | undefined): string {
  if (!branch || branch === "main") return PRODUCTION_URL;
  // Sanitize branch name for subdomain use: replace non-alphanumeric chars with hyphens
  const sanitized = branch
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://${sanitized}-${WORKER_NAME}.${WORKERS_DEV_SUBDOMAIN}.workers.dev`;
}

// Extract global --branch / -b flag and leave remaining args for command parsing
const rawArgs = process.argv.slice(2);
let branch: string | undefined;
const args: string[] = [];

for (let i = 0; i < rawArgs.length; i++) {
  if ((rawArgs[i] === "--branch" || rawArgs[i] === "-b") && i + 1 < rawArgs.length) {
    branch = rawArgs[++i];
  } else {
    args.push(rawArgs[i]);
  }
}

const command = args[0];
const siteUrl = siteUrlFromBranch(branch);

async function main() {
  if (!command) {
    await browse(siteUrl);
  } else if (command === "post") {
    const content = args[1];
    await post(content, siteUrl);
  } else {
    console.error(`Unknown command: ${command}`);
    console.log("Usage:");
    console.log("  micro [--branch <name>]               - Browse all posts");
    console.log("  micro post [--branch <name>]          - Create a new post (TUI editor)");
    console.log('  micro post [--branch <name>] "text"   - Create a new post directly');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
