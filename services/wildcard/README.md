# Wildcard Subdomain Service

A Cloudflare Worker service that handles wildcard subdomain routing for `*.just-be.dev`. The service supports three action types: serving static files from R2, redirecting to external URLs, and proxying (rewriting) to external URLs.

## Architecture

- **KV Storage**: Stores subdomain configurations in JSON format
- **R2 Storage**: Serves static files for subdomain sites
- **Dynamic Routing**: Routes subdomains based on KV configuration

## Configuration Format

Each subdomain is configured via a KV entry where the key is the subdomain name and the value is a JSON configuration object.

### R2 Action (Static File Serving)

Serve static files from an R2 bucket path:

```json
{
  "action": {
    "type": "static",
    "path": "projects/myproject",
    "spa": false,
    "fallback": "404.html"
  }
}
```

**Fields:**

- `type`: Must be `"static"`
- `path`: Path prefix in the R2 bucket (e.g., `"projects/myproject"`)
- `spa`: (Optional) Boolean. If `true`, all routes serve `index.html` for client-side routing. Default: `false`
- `fallback`: (Optional) String. File to serve when requested file is not found. **Only allowed in non-SPA mode** (e.g., `"404.html"`). Cannot be used with `spa: true`. Default: none

**Behavior:**

- Maps URL paths to R2 object keys: `{path}/{url-pathname}`
- Automatically serves `index.html` for directory requests
- Sets appropriate content types based on file extension
- Adds cache headers (`Cache-Control: public, max-age=3600`)

**Fallback Handling:**

- **SPA mode (`spa: true`)**: Always serves `index.html`. If `index.html` doesn't exist, returns 404. **Fallback property is not allowed.**
- **Non-SPA mode (`spa: false` or unset)**:
  - If `fallback` is configured and the requested file doesn't exist, serves the fallback file
  - If `fallback` is not configured, returns 404 for missing files

### Redirect Action

Redirect all traffic to an external URL:

```json
{
  "action": {
    "type": "redirect",
    "url": "https://example.com",
    "permanent": false
  }
}
```

**Fields:**

- `type`: Must be `"redirect"`
- `url`: Target URL (must be a valid https:// or http:// URL, cannot target private/internal IPs)
- `permanent`: (Optional) Boolean. If `true`, uses 301 (permanent). If `false`, uses 302 (temporary). Default: `false`

**Security:**

- SSRF protection: URLs targeting private IP addresses, localhost, or cloud metadata endpoints are blocked

### Rewrite Action (Proxy)

Proxy requests to an external URL while preserving the original path and query:

```json
{
  "action": {
    "type": "rewrite",
    "url": "https://example.com",
    "allowedMethods": ["GET", "POST", "HEAD"]
  }
}
```

**Fields:**

- `type`: Must be `"rewrite"`
- `url`: Base URL to proxy to (must be a valid https:// or http:// URL, cannot target private/internal IPs)
- `allowedMethods`: (Optional) Array of HTTP methods to allow. Default: `["GET", "HEAD", "OPTIONS"]`

**Behavior:**

- Forwards the original path and query string to the target URL
- Only forwards safe request headers (prevents header injection)
- Request timeout of 30 seconds
- Removes `content-encoding` header from response (already decoded by fetch API)

**Security:**

- SSRF protection: URLs targeting private IP addresses, localhost, or cloud metadata endpoints are blocked
- Header filtering: Only safe headers are forwarded (Accept, Accept-Language, etc.)
- Method validation: Only explicitly allowed HTTP methods are permitted

## Setup

### 1. Install Dependencies

```sh
cd services/wildcard
bun install
```

### 2. Create Cloudflare Resources

Create a KV namespace for subdomain configuration:

```sh
wrangler kv:namespace create SUBDOMAIN_CONFIG
```

This will output something like:

```
{ binding = "SUBDOMAIN_CONFIG", id = "abc123..." }
```

Create an R2 bucket for static content:

```sh
wrangler r2 bucket create content-bucket
```

### 3. Update wrangler.toml

Edit `wrangler.toml` and replace the placeholder KV namespace ID:

```toml
[[kv_namespaces]]
binding = "SUBDOMAIN_CONFIG"
id = "abc123..."  # Replace with your actual namespace ID
```

The R2 bucket name should already match (default: `content-bucket`). Update if you used a different name.

## Deployment

Deploy the worker from the root of the project:

```sh
mise run deploy:wildcard
```

Or from the service directory:

```sh
cd services/wildcard
bun run deploy
```

## Usage

### Configuring Subdomains

Add subdomain configurations via the Wrangler CLI:

```sh
cd services/wildcard

# Example: R2 serving for a project
wrangler kv:key put --binding SUBDOMAIN_CONFIG "myproject" '{
  "action": {
    "type": "static",
    "path": "projects/myproject",
    "spa": true
  }
}'

# Example: Redirect to external URL
wrangler kv:key put --binding SUBDOMAIN_CONFIG "blog" '{
  "action": {
    "type": "redirect",
    "url": "https://medium.com/@username",
    "permanent": false
  }
}'

# Example: Proxy to another service
wrangler kv:key put --binding SUBDOMAIN_CONFIG "api" '{
  "action": {
    "type": "rewrite",
    "url": "https://api.example.com"
  }
}'

# Example: Static site with custom 404 page
wrangler kv:key put --binding SUBDOMAIN_CONFIG "portfolio" '{
  "action": {
    "type": "static",
    "path": "sites/portfolio",
    "fallback": "404.html"
  }
}'
```

### Uploading Static Files to R2

Use Wrangler to upload files to the R2 bucket:

```sh
# Upload a single file
wrangler r2 object put content-bucket/projects/myproject/index.html --file ./path/to/index.html

# Upload multiple files (requires a loop or script)
for file in dist/*; do
  wrangler r2 object put "content-bucket/projects/myproject/$(basename $file)" --file "$file"
done
```

### Listing Subdomain Configurations

```sh
cd services/wildcard
wrangler kv:key list --binding SUBDOMAIN_CONFIG
```

### Deleting a Subdomain Configuration

```sh
cd services/wildcard
wrangler kv:key delete --binding SUBDOMAIN_CONFIG "subdomain-name"
```

## Development

Run the worker locally:

```sh
cd services/wildcard
bun run dev
```

This starts a local development server. Note that you'll need to configure local KV and R2 for full functionality.

## Monitoring

View real-time logs:

```sh
cd services/wildcard
bun run tail
```

Or use Wrangler directly:

```sh
wrangler tail just-be-dev-wildcard
```

## Security

This service implements multiple security layers to protect against common attacks:

### SSRF Protection

- All URLs in redirect and rewrite actions are validated to prevent Server-Side Request Forgery
- Blocked targets include:
  - Private IP ranges (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
  - Localhost (127.x.x.x, ::1)
  - Link-local addresses (169.254.x.x, including cloud metadata endpoints)
  - Non-http/https protocols (file://, data://, javascript:, etc.)

### Path Traversal Protection

- All R2 paths are sanitized to prevent directory traversal attacks
- Paths containing `..`, `.`, or null bytes are rejected
- Ensures files are only served from configured directories

### Header Security

- R2 responses include security headers:
  - `X-Content-Type-Options: nosniff` (MIME sniffing prevention)
  - `X-Frame-Options: SAMEORIGIN` (clickjacking protection)
  - `Strict-Transport-Security` (HTTPS enforcement)
  - `Content-Security-Policy` (XSS mitigation)
- Rewrite proxy filters request headers to prevent header injection
- Only safe headers are forwarded (Accept, User-Agent, etc.)
- Sensitive headers (Authorization, Cookie) are never forwarded

### Additional Protections

- Subdomain validation: Maximum 63 characters, alphanumeric and hyphens only
- HTTP method restrictions: Configurable allowed methods for rewrite action
- Request timeout: 30-second timeout on proxy requests
- Error sanitization: Generic error messages prevent information disclosure

### Rate Limiting

**Important:** This service does not implement built-in rate limiting. Consider adding:

- Cloudflare Rate Limiting rules in the dashboard
- Durable Objects for per-subdomain rate limiting
- Monitoring and alerting for unusual traffic patterns

## Behavior

### Unconfigured Subdomains

If a subdomain is not configured in KV or doesn't match the pattern `*.just-be.dev`, the worker redirects to the `ORIGIN_URL` (configured as `https://just-be.dev` in `wrangler.toml`).

### Error Handling

- **Invalid JSON**: Returns 500 error with generic message
- **Invalid Schema**: Returns 500 error and logs validation errors (not exposed to users)
- **Invalid Path**: Returns 400 error
- **File Not Found (R2)**: Returns 404 or serves fallback file
- **Proxy Timeout**: Returns 504 error
- **Proxy Failure (Rewrite)**: Returns 502 error
- **Method Not Allowed**: Returns 405 error with allowed methods

## Environment Variables

Set in `wrangler.toml`:

- `ORIGIN_URL`: Fallback URL for unconfigured/invalid subdomains (default: `https://just-be.dev`)

## Bindings

- `SUBDOMAIN_CONFIG`: KV namespace for subdomain configurations
- `CONTENT_BUCKET`: R2 bucket for static file storage

## Examples

### Hosting a Static Site

1. Upload your site files to R2:

```sh
wrangler r2 object put content-bucket/sites/portfolio/index.html --file ./dist/index.html
wrangler r2 object put content-bucket/sites/portfolio/styles.css --file ./dist/styles.css
# ... upload all files
```

2. Configure the subdomain:

```sh
wrangler kv:key put --binding SUBDOMAIN_CONFIG "portfolio" '{
  "action": {
    "type": "static",
    "path": "sites/portfolio"
  }
}'
```

3. Visit `https://portfolio.just-be.dev`

### Hosting a Single-Page App (SPA)

1. Upload your SPA files to R2 (including `index.html`)

2. Configure with `spa: true`:

```sh
wrangler kv:key put --binding SUBDOMAIN_CONFIG "app" '{
  "action": {
    "type": "static",
    "path": "apps/myapp",
    "spa": true
  }
}'
```

3. All routes will serve `index.html`, allowing client-side routing to work

### Creating a URL Shortener

```sh
wrangler kv:key put --binding SUBDOMAIN_CONFIG "gh" '{
  "action": {
    "type": "redirect",
    "url": "https://github.com/username",
    "permanent": false
  }
}'
```

Visit `https://gh.just-be.dev` → redirects to GitHub profile

### Proxying an API

```sh
wrangler kv:key put --binding SUBDOMAIN_CONFIG "api" '{
  "action": {
    "type": "rewrite",
    "url": "https://api.backend.com",
    "allowedMethods": ["GET", "POST", "PUT", "DELETE"]
  }
}'
```

`https://api.just-be.dev/users/123` → proxies to `https://api.backend.com/users/123`

Only GET, POST, PUT, and DELETE methods are allowed. Other methods return 405 Method Not Allowed.
