# @just-be/wildcard

Portable wildcard subdomain routing library with pluggable storage backends. Route subdomains to static files, redirects, or proxied URLs with dependency injection for maximum flexibility.

## Features

- 🔌 **Pluggable storage backends** - Use any file storage (R2, S3, filesystem, etc.)
- 🔒 **Security built-in** - SSRF protection, path traversal prevention, safe header filtering
- 📦 **Three routing modes**:
  - **Static** - Serve files from any storage backend with SPA mode and custom 404s
  - **Redirect** - 301/302 redirects to external URLs
  - **Rewrite** - Proxy requests to external services
- 🏗️ **Framework-agnostic** - Works with Cloudflare Workers, Node.js, Deno, Bun, etc.
- ✅ **Type-safe** - Full TypeScript support with Zod validation

## Installation

```bash
bun add @just-be/wildcard zod
```

## Quick Start

### 1. Implement Storage Adapters

```ts
import type { FileLoader, RouteConfigLoader } from "@just-be/wildcard";

// Implement your file loader (example with filesystem)
const fileLoader: FileLoader = {
  async loadFile(path: string) {
    try {
      const content = await fs.readFile(path);
      return {
        body: content,
        etag: generateEtag(content),
        headers: new Headers(),
      };
    } catch {
      return null;
    }
  },
};

// Implement your route config loader (example with JSON file)
const routeConfigLoader: RouteConfigLoader = {
  async loadRouteConfig(subdomain: string) {
    try {
      const config = await fs.readFile(`./config/${subdomain}.json`, "utf-8");
      return config;
    } catch {
      return null;
    }
  },
};
```

### 2. Use the Handlers

```ts
import { handleStatic, handleRedirect, handleRewrite, StaticConfigSchema } from "@just-be/wildcard";

// Load and validate config
const configJson = await routeConfigLoader.loadRouteConfig("myapp");
const config = StaticConfigSchema.parse(JSON.parse(configJson));

// Handle the request - pass dependencies after config
const response = await handleStatic(request, config, fileLoader);

// Handlers without dependencies don't need extra args
const redirectResponse = await handleRedirect(request, redirectConfig);
```

## Configuration Schemas

### Static File Serving

```ts
import { StaticConfigSchema } from "@just-be/wildcard";

const config = {
  type: "static",
  path: "apps/myapp", // Base path in storage
  spa: true, // Optional: SPA mode (all routes serve index.html)
  fallback: "404.html", // Optional: Custom 404 (only in non-SPA mode)
};
```

### Redirect

```ts
import { RedirectConfigSchema } from "@just-be/wildcard";

const config = {
  type: "redirect",
  url: "https://example.com",
  permanent: false, // Optional: 301 vs 302
};
```

### Rewrite (Proxy)

```ts
import { RewriteConfigSchema } from "@just-be/wildcard";

const config = {
  type: "rewrite",
  url: "https://api.example.com",
  allowedMethods: ["GET", "POST"], // Optional: defaults to ["GET", "HEAD", "OPTIONS"]
};
```

## Dependency Injection

The library uses dependency injection to decouple from specific storage backends:

```ts
interface FileLoader {
  loadFile(path: string): Promise<FileObject | null>;
}

interface RouteConfigLoader {
  loadRouteConfig(subdomain: string): Promise<string | null>;
}

interface FileObject {
  body: ReadableStream<Uint8Array> | ArrayBuffer | null;
  headers?: Headers;
  etag?: string;
  size?: number;
}
```

## Security Features

- **SSRF Protection** - Blocks requests to private IPs and localhost
- **Path Traversal Prevention** - Sanitizes all file paths
- **Header Filtering** - Only forwards safe headers in proxy mode
- **Content Type Detection** - Sets correct MIME types
- **Security Headers** - Adds CSP, X-Frame-Options, etc.

## Example: Cloudflare Workers

See the `services/wildcard` directory for a complete Cloudflare Workers implementation using R2 and KV.

## API Reference

### Handlers

- `handleStatic(request, config, fileLoader)` - Serve static files from storage
- `handleRedirect(request, config)` - Handle URL redirects (301/302)
- `handleRewrite(request, config)` - Proxy requests to external services

### Schemas

- `StaticConfigSchema` - Validates static file config
- `RedirectConfigSchema` - Validates redirect config
- `RewriteConfigSchema` - Validates rewrite config
- `RouteConfigSchema` - Discriminated union of all configs
- `R2ConfigSchema` - (Deprecated) Alias for StaticConfigSchema

### Utilities

- `sanitizePath(path)` - Sanitize file paths
- `isSafeURL(url)` - Validate URLs for SSRF
- `getContentType(path)` - Detect MIME types
- `filterSafeHeaders(headers)` - Filter request headers
- `isValidSubdomain(subdomain)` - Validate subdomain format

## License

MIT
