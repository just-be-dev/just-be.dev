# Asset Management

## Overview

Assets (images, audio, transcripts) are now managed through a simple deployment workflow without content-addressable hashing.

## Directory Structure

```
public/assets/
  talks/
    codegen-in-rust/
      codegen-1.png
      codegen-2.png
      audio.m4a
      transcript.json
```

## Asset Resolution

The `resolveAssetUrl()` utility (in `src/utils/assets.ts`) follows this priority:

1. If file exists in `public/assets/`, use local path `/assets/{path}`
2. Otherwise, use CDN: `https://assets.just-be.dev/{path}`

## Deployment

Assets are deployed via the `deploy` command:

```bash
# Deploy everything (main site + subdomains including assets)
mise run deploy

# Deploy only the assets subdomain
mise run deploy:subdomains
```

The deploy script:

1. Reads `deploy.json` configuration
2. Uploads `public/assets/` to R2 under the `assets/` prefix
3. Configures routing via KV

## Adding New Assets

1. Add files to `public/assets/` with appropriate paths
2. Reference them in your content (talks, blog posts, etc.)
3. Deploy using `mise run deploy`

## CDN URLs

After deployment, assets are available at:

- Local: `/assets/talks/codegen-in-rust/slide-1.png`
- CDN: `https://assets.just-be.dev/talks/codegen-in-rust/slide-1.png`

## Migration Notes

The old content-addressable system used SHA-256 hashes as filenames. The new system uses the original paths directly, making it easier to manage and understand.

### Downloading Existing Assets

To migrate assets from the old content-addressable bucket, use the download script:

```bash
# Download all assets from the old bucket
bun scripts/download-from-old-bucket.ts
```

This script:

- Reads `src/content/manifest.json` (if it still exists) to map hashes to original paths
- Downloads files from the `just-be-dev-assets` bucket using wrangler
- Saves them to `public/assets/` with their original paths

You can also download individual files manually:

```bash
# List objects in the old bucket
wrangler r2 object list just-be-dev-assets

# Download a specific file
wrangler r2 object get just-be-dev-assets/{hash}.{ext} --file public/assets/{path}
```
