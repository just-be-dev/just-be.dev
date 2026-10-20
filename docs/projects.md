# Projects

Projects on this site come from two places:

- **Desk** ([desk.just-be.dev](https://desk.just-be.dev), repo `~/Code/thoughtflow`) is the system of record. It owns each project's name, one-line description, lifecycle state, `experimental` flag, visibility and links.
- **MDX** in `src/content/projects/<slug>.mdx` holds the long-form prose for a project, and nothing else of substance.

The contract between Desk, projects.just-be.dev and this site lives with the Desk work; the parts this site depends on are summarized here.

## How a page is built

`/projects` and `/projects/<slug>` render on demand. On each request `src/utils/site-projects.ts`:

1. Calls `listPublicProjects()` on Desk's `DeskPlatform` entrypoint through the `DESK` service binding (`wrangler.toml`). Only projects with `visibility = "public"` come back.
2. Joins them with the `projects` content collection (`src/utils/projects.ts`). A Desk project's `site` link names its MDX file: `{ kind: "site", ref: "pex" }` pairs with `src/content/projects/pex.mdx`.

| Field               | Source                                                     |
| ------------------- | ---------------------------------------------------------- |
| Title               | MDX `title` if set, else Desk `name`                       |
| Description         | MDX `description` if set, else Desk `description`          |
| Date                | MDX `date` if set, else Desk `createdAt`                   |
| Code, `slugs`       | MDX only (short URLs, see below)                           |
| State, experimental | Desk                                                       |
| Title link          | Desk `url` link, else its `github` link                    |
| GitHub link         | Desk `github` link                                         |
| Body                | MDX prose; for a project without MDX, its Desk description |

Rules:

- A public Desk project without MDX still gets a row and a minimal page, at `/projects/<site link>` or, with no `site` link, `/projects/<desk slug>`. A Desk slug can't take a slug that an MDX file owns.
- An MDX file with no public Desk project is not listed, and its page redirects to `/projects`. Making a project private in Desk takes it off the site. Its short code and `slugs` aliases redirect to that page, so they land on `/projects` too.
- `/projects` lists projects by state, `active`, `maintenance`, `done`, then `archived`, newest first within a state. `idea` projects aren't listed, but a public idea's page still renders if you link to it.
- `experimental` shows as a badge next to the title.

## States

Desk's vocabulary: `idea | active | maintenance | done | archived`, plus the `experimental` flag. Colours live in `src/components/ProjectStatus.astro`.

## MDX frontmatter

All fields are optional overrides. The schema (`src/content/schemas.ts`) is strict, so the retired `status`, `url` and `repository` fields fail the build; set those in Desk instead.

```yaml
---
date: 2026-01-24 # shown on the page; also used by gen-codes
code: p2530 # short code, /p2530
slugs: # extra paths that redirect here
  - /pex
title: PEX Lang # only to override Desk's name
description: ... # only to override Desk's description
---
::readme{repo="just-be-dev/pex"}
```

To add a project page: create the project in Desk (public, with a `site` link to the new slug), add `src/content/projects/<slug>.mdx`, and run `mise run gen-codes` and `mise run gen-url-manifest`.

## Caching and failure

`src/utils/desk.ts` caches Desk's answer per Worker isolate: a good answer is reused for 60 seconds, concurrent requests share one call, a call is abandoned after 2.5 seconds, and after a failure Desk isn't asked again for 15 seconds. While Desk fails, the last good answer is served for up to a day. Responses carry `Cache-Control: public, max-age=60, stale-while-revalidate=600`.

If Desk is unreachable and nothing is cached, the pages never fail: `/projects` lists every MDX file by date without state, titled by slug unless the MDX sets a `title`, and every MDX page renders without state. Desk-only projects are missing until Desk is back. Responses then carry `Cache-Control: no-store`. Failures are logged with a `[desk]` prefix (Workers observability).

## Local development

| Command                                                    | Desk data                                                                                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mise run dev`                                             | Fixture data from `src/utils/desk-fixture.ts`, including Desk-only, archived and idea projects                                                     |
| `mise run dev:desk`                                        | Prod Desk, through a remote binding (`CLOUDFLARE_ENV=desk-remote`, see `[env.desk-remote]` in `wrangler.toml`). Needs `wrangler login`. Read-only. |
| `DESK_DEV=unavailable` in `.dev.vars`, then `mise run dev` | Simulates Desk being down                                                                                                                          |

`DESK_DEV` is only read by `astro dev`. A production build (`mise run build`, `wrangler dev -c dist/server/wrangler.json`) always calls the binding; with no Desk Worker running locally that exercises the unavailable path.

## Changing the Desk Worker

The `DESK` binding names Desk's private API Worker and the `DeskPlatform` entrypoint. If Desk's stack replaces that Worker, update `service` in both `[[services]]` blocks of `wrangler.toml` and redeploy the site.
