/// <reference types="@cloudflare/workers-types" />

type Runtime = import("@astrojs/cloudflare").Runtime<{
  MICRO_DB: D1Database;
  MICRO_SECRET?: string;
  BLUESKY_IDENTIFIER?: string;
  BLUESKY_PASSWORD?: string;
  TWITTER_APP_KEY?: string;
  TWITTER_APP_SECRET?: string;
  TWITTER_ACCESS_TOKEN?: string;
  TWITTER_ACCESS_SECRET?: string;
}>;

declare namespace App {
  interface Locals extends Runtime {}
}
