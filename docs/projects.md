# Projects

Projects on this site come from two places:

- **Desk** ([desk.just-be.dev](https://desk.just-be.dev), repo `~/Code/thoughtflow`) is the system of record. It owns each project's short code, name, one-line description, lifecycle state, `experimental` flag, visibility and links.
- **MDX** in `src/content/projects/<slug>.mdx` holds the long-form prose for a project, and nothing else of substance.

The contract between Desk, projects.just-be.dev and this site lives with the Desk work; the parts this site depends on are summarized here.

## How a page is built

`/projects` and `/projects/<slug>` render on demand. On each request `src/utils/site-projects.ts`:

1. Calls `listPublicProjects()` on Desk's private API Worker through the `DESK` service binding (`wrangler.toml`). The RPC methods (Desk calls the surface `DeskPlatform`) live on that Worker's default entrypoint, so the binding has no `entrypoint`. Only projects with `visibility = "public"` come back. Desk returns errors instead of throwing them: the call resolves to either the array or `{ _tag, message }` (for example `_tag: "Unavailable"`), and the site treats an error value like a failed call.
2. Joins them with the `projects` content collection (`src/utils/projects.ts`). A Desk project's `site` link names its MDX file: `{ kind: "site", ref: "pex" }` pairs with `src/content/projects/pex.mdx`.

| Field               | Source                                                     |
| ------------------- | ---------------------------------------------------------- |
| Title               | MDX `title` if set, else Desk `name`                       |
| Description         | MDX `description` if set, else Desk `description`          |
| Date                | MDX `date` if set, else Desk `createdAt`                   |
| Code                | Desk `code` (see Short codes)                              |
| `slugs` aliases     | MDX only                                                   |
| State, experimental | Desk                                                       |
| Title link          | Desk `url` link, else its `github` link                    |
| GitHub link         | Desk `github` link, unless it's the same as the `url` link |
| Body                | MDX prose; for a project without MDX, its Desk description |

Rules:

- A public Desk project without MDX still gets a row and a minimal page, at `/projects/<site link>` or, with no `site` link, `/projects/<desk slug>`. A Desk slug can't take a slug that an MDX file owns.
- An MDX file with no public Desk project is not listed, and its page redirects to `/projects`. Making a project private in Desk takes it off the site. Its short code then 404s, and its `slugs` aliases redirect to that page, so they land on `/projects`.
- `/projects` lists projects by state, `active`, `maintenance`, `done`, then `archived`, newest first within a state. `idea` projects aren't listed, but a public idea's page still renders if you link to it.
- `experimental` shows as a badge next to the title.

## Short codes

Desk owns project short codes: `code` on each Desk project, `p` plus 4 lowercase hex digits (`p2530`), unique across Desk and never reused. The site shows it upper-case on `/projects` and on the project page, for Desk-only projects too.

`/p2530` (any case) resolves at request time in `src/middleware.ts`: it loads the joined projects and redirects (302, since the target slug can change) to `/projects/<slug>` of the project with that code, using the slug the join picked (`projectCodePath`). A code with no public project 404s. Project codes are not in `url-manifest.yaml`; other kinds still are.

`slugs` aliases (`/pex`) come from the MDX frontmatter and redirect (301) to `/projects/<file name>` without asking Desk (`projectAliasPath`).

`desk.ts` requires `code` and lowercases it. A project whose code is missing or malformed is dropped with a warning, like any other project that doesn't match the contract. When Desk is unavailable and nothing is cached, MDX-only pages have no code, and `/pXXXX` doesn't resolve (404) until Desk is back; `slugs` aliases still work.

## States

Desk's vocabulary: `idea | active | maintenance | done | archived`, plus the `experimental` flag. Colours live in `src/components/ProjectStatus.astro`.

## MDX frontmatter

All fields are optional. The schema (`src/content/schemas.ts`) is strict, so the retired `code`, `status`, `url` and `repository` fields fail the build; set those in Desk instead.

```yaml
---
date: 2026-01-24 # shown on the page
slugs: # extra paths that redirect here
  - /pex
title: PEX Lang # only to override Desk's name
description: ... # only to override Desk's description
---
::readme{repo="just-be-dev/pex"}
```

To add a project page: create the project in Desk (public, with a `site` link to the new slug; Desk assigns its code) and add `src/content/projects/<slug>.mdx`. No code generation is needed.

## Caching and failure

`src/utils/desk.ts` caches Desk's answer per Worker isolate: a good answer is reused for 60 seconds, concurrent requests share one call, a call is abandoned after 2.5 seconds, and after a failure Desk isn't asked again for 15 seconds. While Desk fails, the last good answer is served for up to a day. Responses carry `Cache-Control: public, max-age=60, stale-while-revalidate=600`.

If Desk is unreachable and nothing is cached, the pages never fail: `/projects` lists every MDX file by date without state or code, titled by slug unless the MDX sets a `title`, and every MDX page renders without state or code. Desk-only projects are missing until Desk is back. Responses then carry `Cache-Control: no-store`. Failures are logged with a `[desk]` prefix (Workers observability).

## Local development

| Command                                                    | Desk data                                                                                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mise run dev`                                             | Fixture data from `src/utils/desk-fixture.ts`, including Desk-only (`/p24dd`), archived and idea projects                                          |
| `mise run dev:desk`                                        | Prod Desk, through a remote binding (`CLOUDFLARE_ENV=desk-remote`, see `[env.desk-remote]` in `wrangler.toml`). Needs `wrangler login`. Read-only. |
| `DESK_DEV=unavailable` in `.dev.vars`, then `mise run dev` | Simulates Desk being down                                                                                                                          |

`DESK_DEV` is only read by `astro dev`. A production build (`mise run build`, `wrangler dev -c dist/server/wrangler.json`) always calls the binding; with no Desk Worker running locally that exercises the unavailable path.

## Changing the Desk Worker

The `DESK` binding names Desk's private API Worker (prod: `desk-api-prod-52zp2vud3ktnsddd`, generated by Desk's Alchemy stack) whose default entrypoint carries the RPC methods. If Desk's stack replaces that Worker, update `service` in both `[[services]]` blocks of `wrangler.toml` and push to `main`; Workers Builds redeploys the site. The binding must point at a Worker that exists and exists, or the deploy fails.

## READMEs

`::readme{repo="owner/name"}` in an MDX file embeds the repository's README (`src/components/Readme.astro`, the `readme` live collection in `src/live.config.ts`). `src/utils/github-readme.ts` fetches it from `raw.githubusercontent.com/<owner>/<repo>/HEAD/README.md`, not the GitHub REST API: the API's unauthenticated limit is 60 requests an hour per IP, shared with everything else on Cloudflare's egress IPs, and it returned 403s in production. `HEAD` is the default branch, so relative links point at `github.com/<owner>/<repo>/blob/HEAD/...` and relative images (markdown and raw `<img>`) at the raw file.

Rendered READMEs are cached for 10 minutes in the isolate and in the Workers Cache API, and the raw fetch is edge-cached for 10 minutes. If GitHub fails, the last good copy is served for up to 7 days; the "README not available" box only shows when there has never been a good copy or the README doesn't exist.
