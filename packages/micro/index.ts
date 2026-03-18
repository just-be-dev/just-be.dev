#!/usr/bin/env bun

import { deletePost, list } from "./src/browse.ts";
import { post } from "./src/post.ts";

const PRODUCTION_URL = "https://just-be.dev";
const WORKER_NAME = "just-be-dev";
const WORKERS_DEV_SUBDOMAIN = "just-be";

function siteUrlFromBranch(branch: string | undefined): string {
  if (!branch || branch === "main") return PRODUCTION_URL;
  const sanitized = branch
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://${sanitized}-${WORKER_NAME}.${WORKERS_DEV_SUBDOMAIN}.workers.dev`;
}

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
  if (!command || command === "list") {
    await list(siteUrl);
  } else if (command === "post") {
    await post(args[1], siteUrl);
  } else if (command === "delete") {
    const id = Number(args[1]);
    if (!args[1] || !Number.isFinite(id)) {
      console.error("Usage: micro delete <id>");
      process.exit(1);
    }
    await deletePost(id, siteUrl);
  } else {
    console.error(`Unknown command: ${command}`);
    console.log("Usage:");
    console.log("  micro [list] [--branch <name>]              - List all posts");
    console.log(
      '  micro post [--branch <name>] ["text"]       - Create a post (reads stdin if no text)',
    );
    console.log("  micro delete [--branch <name>] <id>         - Delete a post");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
