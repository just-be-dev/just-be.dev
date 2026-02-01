# @just-be/deploy

Deploy static sites and setup routing for the wildcard subdomain service.

## Requirements

- [Bun](https://bun.sh/) runtime
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) CLI configured with Cloudflare credentials
- A Cloudflare Workers wildcard subdomain service with R2 and KV configured

## Installation

No installation needed! Run directly with `bunx`:

```bash
bunx @just-be/deploy
```

Or install globally:

```bash
bun install -g @just-be/deploy
```

## Usage

### Basic Usage

Create a `deploy.json` file in your project:

```json
{
  "rules": [
    {
      "subdomain": "myapp",
      "type": "static",
      "path": "apps/myapp",
      "dir": "./dist",
      "spa": true
    },
    {
      "subdomain": "old-site",
      "type": "redirect",
      "url": "https://new-site.com",
      "permanent": true
    }
  ]
}
```

Then run:

```bash
bunx @just-be/deploy
```

### Specify Config Path

```bash
bunx @just-be/deploy path/to/config.json
```

## Rule Types

### Static Site

Deploy static files to R2 and serve them via a subdomain.

```json
{
  "subdomain": "myapp",
  "type": "static",
  "path": "apps/myapp",
  "dir": "./dist",
  "spa": true
}
```

**Options:**

- `subdomain` (required): Subdomain name (e.g., "myapp" for myapp.just-be.dev)
- `type` (required): Must be "static"
- `path` (required): R2 path prefix where files will be stored
- `dir` (required): Local directory containing files to upload
- `spa` (optional): Enable SPA mode - all routes serve index.html
- `fallback` (optional): Custom 404 file (cannot be used with `spa`)

### Redirect

Configure an HTTP redirect from a subdomain to another URL.

```json
{
  "subdomain": "old-site",
  "type": "redirect",
  "url": "https://new-site.com",
  "permanent": true
}
```

**Options:**

- `subdomain` (required): Subdomain name
- `type` (required): Must be "redirect"
- `url` (required): Target URL (must be http/https)
- `permanent` (optional): Use 301 (permanent) redirect instead of 302 (temporary)

### Rewrite (Reverse Proxy)

Proxy requests from a subdomain to another URL.

```json
{
  "subdomain": "api",
  "type": "rewrite",
  "url": "https://api.example.com",
  "allowedMethods": ["GET", "POST", "PUT", "DELETE"]
}
```

**Options:**

- `subdomain` (required): Subdomain name
- `type` (required): Must be "rewrite"
- `url` (required): Target URL to proxy to (must be http/https)
- `allowedMethods` (optional): HTTP methods allowed (default: ["GET", "HEAD", "OPTIONS"])

## Examples

### Multiple Static Sites

```json
{
  "rules": [
    {
      "subdomain": "portfolio",
      "type": "static",
      "path": "sites/portfolio",
      "dir": "./build",
      "fallback": "404.html"
    },
    {
      "subdomain": "docs",
      "type": "static",
      "path": "sites/docs",
      "dir": "./out",
      "spa": true
    },
    {
      "subdomain": "blog",
      "type": "static",
      "path": "sites/blog",
      "dir": "./dist"
    }
  ]
}
```

### Mixed Deployments

```json
{
  "rules": [
    {
      "subdomain": "app",
      "type": "static",
      "path": "apps/main",
      "dir": "./dist",
      "spa": true
    },
    {
      "subdomain": "legacy",
      "type": "redirect",
      "url": "https://app.just-be.dev",
      "permanent": true
    },
    {
      "subdomain": "api",
      "type": "rewrite",
      "url": "https://backend.example.com",
      "allowedMethods": ["GET", "POST", "PUT", "DELETE", "PATCH"]
    }
  ]
}
```

## Editor Support

The package includes a JSON Schema (`deploy.schema.json`) for editor validation and autocomplete. Many editors will automatically provide validation and suggestions for `deploy.json` files.

## How It Works

1. **Parses configuration** from `deploy.json`
2. **Validates** all rules using Zod schemas from `@just-be/wildcard`
3. **For static sites**:
   - Scans the local directory for all files
   - Uploads each file to R2 at `content-bucket/{path}/{relative-path}`
   - Creates a KV entry with routing configuration
4. **For redirects/rewrites**:
   - Creates a KV entry with the routing configuration
5. **Configures** the wildcard service to route requests for each subdomain

## Configuration

The script expects your wildcard service to use:

- **R2 Bucket**: `content-bucket`
- **KV Binding**: `ROUTING_RULES`
- **Wrangler Config**: `services/wildcard/wrangler.toml`

## Validation

Configuration is validated using Zod schemas to ensure:

- Valid subdomain format (alphanumeric with hyphens, 1-63 characters)
- SPA mode and fallback file are not used together
- Required fields are present for each rule type
- URLs are safe (http/https only)

## Related Packages

- [`@just-be/wildcard`](../wildcard) - Shared Zod schemas and routing handlers for wildcard subdomain configuration

## License

MIT
