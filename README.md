# just-be.dev

Welcome to my little corner of the internet. My site is build with Astro and themed after the TUIs that have inspired my whole career.

## Setup

I use [mise](https://mise.jdx.dev/) for managing development tools. If you don't have mise installed:

```sh
curl https://mise.run | sh
```

Then install the project dependencies:

```sh
mise install
```

## Development

```sh
mise run dev
```

The site will be available at `localhost:4321`.

## Projects

Project data (name, description, state, links, visibility) lives in [Desk](https://desk.just-be.dev), which the site reads at request time through a Cloudflare service binding. `src/content/projects/` holds only the long-form write-up for each project. `mise run dev` uses fixture data; `mise run dev:desk` reads prod Desk. See [docs/projects.md](docs/projects.md).

## Building

```sh
mise run build
```

## Deployment

This site is deployed to Cloudflare Workers by Cloudflare Workers Builds on every push to `main`. `mise run deploy` deploys the subdomains and the router in front of the site.
