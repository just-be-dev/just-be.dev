# @just-be/micro

CLI tool for creating and managing micro blog posts.

## Features

- Browse all micro posts in a TUI interface
- Create posts with a TUI editor (280 character limit)
- Create posts directly from command line
- Automatic syndication to Bluesky and Twitter
- Delete posts
- Open posts in browser
- R2 JSONL storage via HTTP API

## Installation

```bash
bun add @just-be/micro
```

## Usage

### Browse posts

```bash
bunx @just-be/micro
```

Opens a TUI interface to browse all posts. You can:

- Navigate through posts
- View post details
- Open posts on the website
- Delete posts

### Create a post with TUI editor

```bash
bunx @just-be/micro post
```

Opens an interactive editor to compose a new post (280 character limit).

### Create a post directly

```bash
bunx @just-be/micro post "Your post content here"
```

Creates a post directly from the command line.

## Requirements

- Bun >= 1.0.0
- A running instance of the site with `MICRO_BUCKET` (R2) and `MICRO_SECRET` configured

## Social Media Syndication

Posts are automatically syndicated to configured social media platforms when created.

### Environment Variables

Configure syndication by setting the following environment variables:

#### Bluesky

```bash
BLUESKY_IDENTIFIER=your-handle.bsky.social
BLUESKY_PASSWORD=your-app-password
```

To get a Bluesky app password:

1. Go to Settings > App Passwords in the Bluesky app
2. Create a new app password
3. Use that password (not your account password)

#### Twitter/X

```bash
TWITTER_APP_KEY=your-app-key
TWITTER_APP_SECRET=your-app-secret
TWITTER_ACCESS_TOKEN=your-access-token
TWITTER_ACCESS_SECRET=your-access-secret
```

To get Twitter API credentials:

1. Apply for a Twitter Developer account at https://developer.twitter.com
2. Create a new app in the Developer Portal
3. Generate API keys and access tokens

### Syndication Behavior

- Posts are saved to R2 first, ensuring they're preserved even if syndication fails
- Syndication attempts are made to all configured platforms
- The `syndicatedTo` field tracks which platforms received the post
- Syndication failures are logged but don't prevent post creation
- Rate limits and authentication errors are handled gracefully with clear error messages

### Testing Syndication

To test syndication without real API credentials, simply don't set the environment variables. Posts will be created normally without syndication attempts.

## Development

The CLI talks to the site's HTTP API. Set `MICRO_SECRET` to authenticate and `MICRO_SITE_URL` to point at a local dev server (defaults to `https://just-be.dev`).
