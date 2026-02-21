import { AtpAgent } from "@atproto/api";
import { TwitterApi } from "twitter-api-v2";

export interface SyndicationResult {
  platform: string;
  success: boolean;
  error?: string;
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

/**
 * Syndicate a post to configured social media platforms
 * @param content - The post content (max 280 characters)
 * @param config - Platform API credentials
 * @returns Array of syndication results for each platform
 */
export async function syndicatePost(
  content: string,
  config: SyndicationConfig,
): Promise<SyndicationResult[]> {
  const results: SyndicationResult[] = [];

  // Validate content length
  if (content.length > 280) {
    throw new Error("Post content exceeds 280 character limit");
  }

  // Syndicate to Bluesky
  if (config.bluesky) {
    const result = await syndicateToBluesky(content, config.bluesky);
    results.push(result);
  }

  // Syndicate to Twitter
  if (config.twitter) {
    const result = await syndicateToTwitter(content, config.twitter);
    results.push(result);
  }

  return results;
}

/**
 * Syndicate a post to Bluesky using AT Protocol
 */
async function syndicateToBluesky(
  content: string,
  credentials: { identifier: string; password: string },
): Promise<SyndicationResult> {
  try {
    const agent = new AtpAgent({
      service: "https://bsky.social",
    });

    await agent.login({
      identifier: credentials.identifier,
      password: credentials.password,
    });

    const response = await agent.post({
      text: content,
      createdAt: new Date().toISOString(),
    });

    return {
      platform: "bluesky",
      success: true,
      url: `https://bsky.app/profile/${credentials.identifier}/post/${response.uri.split("/").pop()}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Bluesky syndication failed:", errorMessage);

    // Check for rate limiting
    if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
      return {
        platform: "bluesky",
        success: false,
        error: "Rate limit exceeded. Please try again later.",
      };
    }

    // Check for authentication errors
    if (
      errorMessage.includes("auth") ||
      errorMessage.includes("credential") ||
      errorMessage.includes("401")
    ) {
      return {
        platform: "bluesky",
        success: false,
        error: "Authentication failed. Please check your credentials.",
      };
    }

    return {
      platform: "bluesky",
      success: false,
      error: `Failed to post to Bluesky: ${errorMessage}`,
    };
  }
}

/**
 * Syndicate a post to Twitter/X using API v2
 */
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

    const tweet = await client.v2.tweet({
      text: content,
    });

    return {
      platform: "twitter",
      success: true,
      url: `https://twitter.com/i/web/status/${tweet.data.id}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Twitter syndication failed:", errorMessage);

    // Check for rate limiting
    if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
      return {
        platform: "twitter",
        success: false,
        error: "Rate limit exceeded. Please try again later.",
      };
    }

    // Check for authentication errors
    if (
      errorMessage.includes("auth") ||
      errorMessage.includes("credential") ||
      errorMessage.includes("401")
    ) {
      return {
        platform: "twitter",
        success: false,
        error: "Authentication failed. Please check your credentials.",
      };
    }

    // Check for duplicate tweets
    if (errorMessage.includes("duplicate")) {
      return {
        platform: "twitter",
        success: false,
        error: "Duplicate post detected.",
      };
    }

    return {
      platform: "twitter",
      success: false,
      error: `Failed to post to Twitter: ${errorMessage}`,
    };
  }
}

/**
 * Load syndication configuration from environment variables
 */
export function loadSyndicationConfig(): SyndicationConfig {
  const config: SyndicationConfig = {};

  // Load Bluesky credentials
  const blueskyIdentifier = process.env.BLUESKY_IDENTIFIER;
  const blueskyPassword = process.env.BLUESKY_PASSWORD;

  if (blueskyIdentifier && blueskyPassword) {
    config.bluesky = {
      identifier: blueskyIdentifier,
      password: blueskyPassword,
    };
  }

  // Load Twitter credentials
  const twitterAppKey = process.env.TWITTER_APP_KEY;
  const twitterAppSecret = process.env.TWITTER_APP_SECRET;
  const twitterAccessToken = process.env.TWITTER_ACCESS_TOKEN;
  const twitterAccessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (twitterAppKey && twitterAppSecret && twitterAccessToken && twitterAccessSecret) {
    config.twitter = {
      appKey: twitterAppKey,
      appSecret: twitterAppSecret,
      accessToken: twitterAccessToken,
      accessSecret: twitterAccessSecret,
    };
  }

  return config;
}

/**
 * Check if any syndication platforms are configured
 */
export function hasSyndicationConfig(config: SyndicationConfig): boolean {
  return !!(config.bluesky || config.twitter);
}
