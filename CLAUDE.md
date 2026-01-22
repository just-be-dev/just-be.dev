# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal website built with Astro and themed after TUIs (Text User Interfaces). The site features blog posts, projects, research notes, and an RSS feed. It's deployed to Cloudflare Workers.

## Development Environment

This project uses [mise](https://mise.jdx.dev/) for managing development tools. The mise configuration is in `mise.toml`.

### Initial Setup

```sh
# Install mise (if not already installed)
curl https://mise.run | sh

# Install project dependencies
mise install
```

## Common Commands

All development commands should be run through mise:

```sh
# Start development server (runs on localhost:4321)
mise run dev

# Build for production
mise run build

# Preview production build
mise run preview

# Format code with Prettier
mise run fmt

# Run tests
mise run test

# Run tests with UI
mise run test:ui

# Ensure content files have codes in frontmatter
mise run gen-codes

# Deploy to Cloudflare Workers
mise run deploy
```

## Architecture

### Content Collections

The site uses Astro's content collections with file-based loaders defined in `src/content.config.ts`:

- **blog**: Blog posts in `src/content/blog/` with title, description, date, tags, and draft status
- **projects**: Project entries in `src/content/projects/` with status (active, completed, archived, maintenance)
- **research**: Research notes in `src/content/research/` with draft/published/archived status and topics
- **pages**: General pages in `src/content/pages/` (including the homepage)
- **devtools**: External RSS feed from devtools.fm podcast

### MDC Syntax Support

The site uses MDC (Markdown Components) syntax from Nuxt Content, converted to MDX via a custom remark plugin (`src/plugins/remark-mdc-to-mdx.ts`). This enables component usage in markdown:

- `::card` → block component
- `:icon` → inline component
- `[text]{.class}` → span with class
- Component attributes can be bound with `:attr="frontmatter.path"`

The plugin automatically imports components from `src/components/` based on usage.

### File Naming Convention

Content files use simple slug-based filenames: `{slug}.mdx`

Each file has a `code` field in its frontmatter containing a unique identifier:

- Kind prefix: `b` (blog), `r` (research), `p` (projects), `t` (talks)
- Hex date: 4-character lowercase hex timestamp derived from the date field
- Format: `{kind}{hex-date}` (e.g., `b232e`)
- The `mise run gen-codes` script ensures all files have a code in frontmatter

Example filename: `building-a-deno-desktop-framework.mdx` with `code: b232e` in frontmatter

### Styling System

The project uses a custom UnoCSS configuration (`uno.config.ts`) that integrates with WebTUI CSS variables:

- **Spacing**: Uses `ch` (character width) for horizontal and `lh` (line height) for vertical spacing
- **Colors**: Maps to WebTUI CSS variables (e.g., `var(--foreground0)`)
- **Custom rules**: `px-1` = 1ch padding, `py-1` = 1lh padding, etc.
- **Custom variants**: `hocus:` (hover + focus), `group-hocus:`

### Keyboard Shortcuts

The site includes a client-side keyboard shortcut system (`src/client/keyboard-shortcuts.ts`) that:

- Finds elements with `data-key` attributes
- Binds global keyboard shortcuts
- Ignores shortcuts when typing in inputs or when meta key is pressed
- Can be refreshed via `window.refreshKeyboardShortcuts()`

### Deployment

The site is deployed to Cloudflare Workers with configuration in `wrangler.toml`:

- Static assets in `./dist`
- Custom domain: `just-be.dev`
- Observability enabled

## Code Organization

- **src/pages/**: Route pages (dynamic routes for blog, projects, research)
- **src/components/**: Reusable Astro components
- **src/layouts/**: Page layout templates
- **src/content/**: MDX content files organized by collection
- **src/plugins/**: Custom remark plugins
- **src/utils/**: Utility functions (code generation, date formatting)
- **src/client/**: Client-side JavaScript
- **scripts/**: Build scripts and utilities

## Git Hooks

Lefthook is configured (`lefthook.yml`) to run Prettier on staged files before commit. It's automatically installed via mise postinstall hook.

## Testing

The project uses Vitest with inline tests enabled (`vitest.config.ts`). Tests can be co-located with source code using `if (import.meta.vitest)` blocks.

## Monitoring

Sentry is integrated for error tracking. Configuration requires:

- `PUBLIC_SENTRY_DSN` (public DSN)
- `SENTRY_PROJECT` (project name)
- `SENTRY_AUTH_TOKEN` (for source map uploads)
