import { AtpAgent } from "@atproto/api";
import { TwitterApi } from "twitter-api-v2";

export interface SyndicationResult {
  platform: string;
  success: boolean;
  error?: string;
  id?: string;
  url?: string;
}

export interface SyndicationConfig {
  bluesky?: {
    identifier: string;
    password: string;
  };
  twitter?: {
    appKey: string;
    appSecret: string;
    accessToken: string;
    accessSecret: string;
  };
}

export async function syndicatePost(
  content: string,
  config: SyndicationConfig,
): Promise<SyndicationResult[]> {
  const results: SyndicationResult[] = [];

  if (config.bluesky) {
    results.push(await syndicateToBluesky(content, config.bluesky));
  }

  if (config.twitter) {
    results.push(await syndicateToTwitter(content, config.twitter));
  }

  return results;
}

async function syndicateToBluesky(
  content: string,
  credentials: { identifier: string; password: string },
): Promise<SyndicationResult> {
  try {
    const agent = new AtpAgent({ service: "https://bsky.social" });
    await agent.login({ identifier: credentials.identifier, password: credentials.password });
    const response = await agent.post({ text: content, createdAt: new Date().toISOString() });
    const postId = response.uri.split("/").pop() || "";
    return {
      platform: "bluesky",
      success: true,
      id: postId,
      url: `https://bsky.app/profile/${credentials.identifier}/post/${postId}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes("rate limit") || msg.includes("429")) {
      return { platform: "bluesky", success: false, error: "Rate limit exceeded." };
    }
    if (msg.includes("auth") || msg.includes("credential") || msg.includes("401")) {
      return { platform: "bluesky", success: false, error: "Authentication failed." };
    }
    return { platform: "bluesky", success: false, error: `Failed to post: ${msg}` };
  }
}

async function syndicateToTwitter(
  content: string,
  credentials: {
    appKey: string;
    appSecret: string;
    accessToken: string;
    accessSecret: string;
  },
): Promise<SyndicationResult> {
  try {
    const client = new TwitterApi({
      appKey: credentials.appKey,
      appSecret: credentials.appSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret,
    });
    const tweet = await client.v2.tweet({ text: content });
    return {
      platform: "twitter",
      success: true,
      id: tweet.data.id,
      url: `https://twitter.com/i/web/status/${tweet.data.id}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes("rate limit") || msg.includes("429")) {
      return { platform: "twitter", success: false, error: "Rate limit exceeded." };
    }
    if (msg.includes("auth") || msg.includes("credential") || msg.includes("401")) {
      return { platform: "twitter", success: false, error: "Authentication failed." };
    }
    if (msg.includes("duplicate")) {
      return { platform: "twitter", success: false, error: "Duplicate post detected." };
    }
    return { platform: "twitter", success: false, error: `Failed to post: ${msg}` };
  }
}
