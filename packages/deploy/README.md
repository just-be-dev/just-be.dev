# @just-be/deploy

Deploy static files to Cloudflare R2 and configure subdomain routing in KV for wildcard subdomain services.

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

### Interactive Mode

Simply run without arguments to be prompted for all configuration:

```bash
bunx @just-be/deploy
```

The interactive mode will ask you for:
- Subdomain name
- R2 path prefix
- Local directory to upload
- Whether to enable SPA mode
- Whether to use a custom fallback file

### Command-Line Mode

Provide all arguments upfront:

```bash
bunx @just-be/deploy --subdomain=NAME --path=PATH --dir=DIR [--spa] [--fallback=FILE]
```

### Arguments

- `--subdomain`: Subdomain name (e.g., "myapp" for myapp.just-be.dev)
- `--path`: R2 path prefix where files will be stored (e.g., "apps/myapp")
- `--dir`: Local directory to upload
- `--spa`: (Optional) Enable SPA mode - all routes serve index.html
- `--fallback`: (Optional) Custom fallback file for 404s (only in non-SPA mode)

### Examples

**Interactive deployment:**
```bash
bunx @just-be/deploy
```

**Deploy a static site:**
```bash
bunx @just-be/deploy \
  --subdomain=portfolio \
  --path=sites/portfolio \
  --dir=./dist
```

**Deploy a single-page application:**
```bash
bunx @just-be/deploy \
  --subdomain=myapp \
  --path=apps/myapp \
  --dir=./build \
  --spa
```

**Deploy with custom 404 page:**
```bash
bunx @just-be/deploy \
  --subdomain=docs \
  --path=sites/docs \
  --dir=./out \
  --fallback=404.html
```

## How It Works

1. **Parses arguments** using Node's `util.parseArgs` API
2. **Prompts for missing values** if any required arguments are not provided
3. **Validates configuration** using Zod schemas from `@just-be/wildcard-schemas`
4. **Scans** the target directory for all files
5. **Uploads** each file to R2 at `content-bucket/{path}/{relative-path}`
6. **Creates** a KV entry with routing configuration for the subdomain
7. **Configures** the wildcard service to serve your site at `https://{subdomain}.just-be.dev`

## Configuration

The script expects your wildcard service to use:
- **R2 Bucket**: `content-bucket`
- **KV Binding**: `ROUTING_RULES`
- **Wrangler Config**: `services/wildcard/wrangler.toml`

## Validation

Configuration is validated using Zod schemas to ensure:
- SPA mode and fallback file are not used together
- R2 path is not empty
- All required fields are present

## Related Packages

- [`@just-be/wildcard-schemas`](../wildcard-schemas) - Shared Zod schemas for configuration validation

## License

MIT
