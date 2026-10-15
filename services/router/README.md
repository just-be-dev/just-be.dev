# Router

The microfrontend router for `just-be.dev`, following Cloudflare's [microfrontends guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/microfrontends/). It owns the `just-be.dev/*` route and sends each request over a service binding to the Worker mounted at the longest matching path:

| Path        | Binding  | Worker                                                              |
| ----------- | -------- | ------------------------------------------------------------------- |
| `/traces/*` | `TRACES` | Traces Website (`traces-app-prod-…`, deployed from the traces repo) |
| `/*`        | `SITE`   | This site (`just-be-dev`)                                           |

Each app keeps its own repo and deploy. The router only needs a redeploy when the routes or bindings change.

## Mounted apps

A mounted app is written for `/` and doesn't know its mount. The router:

- strips the mount before forwarding, so `/traces/install` reaches Traces as `/install`
- sets `x-forwarded-host`, `x-forwarded-proto`, and `x-forwarded-prefix` (the mount)
- prefixes root-relative URLs in HTML attributes (`href`, `src`, `action`, `formaction`, `poster`, `srcset`, `imagesrcset`), in CSS `url()`, and in same-origin `Location` headers
- scopes `Set-Cookie` paths to the mount

URLs built at runtime in a mounted app's JavaScript are not rewritten. Traces has none today. If it adds client-side routing or fetches, it should read its base from the page instead of assuming `/`.

## Shared header

Routes with `"header": true` get the site header injected at the top of `<body>` in every HTML page. The router fetches it from `/fragments/header/` on the site, which renders `src/components/Nav.astro`, the same component every site page uses. The header renders into a declarative shadow root, so the mounted app's CSS can't change it and it can't change the app. Its script is an external same-origin file, which a strict `script-src 'self'` policy allows. The fragment also reserves room for the fixed bars with body padding.

If the fragment can't be loaded, the page is served without it and a warning is logged. Pages with the header drop their `ETag` and `Last-Modified`, since they now also change when the site deploys.

The mounted app should give its main element `id="main-content"` for the header's skip link, and load IBM Plex Mono at weights 400 and 700 from its own origin. The header names the font but can't load it under a strict `font-src`.

## Configuration

`ROUTES` in `wrangler.toml` is JSON:

```json
{
  "routes": [
    { "path": "/traces", "binding": "TRACES", "header": true },
    { "path": "/", "binding": "SITE" }
  ],
  "header": { "binding": "SITE", "path": "/fragments/header/" }
}
```

Paths are static prefixes without a trailing slash. A mount matches itself and anything below it, so `/traces` matches `/traces/x` but not `/tracesx`.

Alchemy generates the Traces Website's Worker name. If the Website is ever replaced, read the new name from the stack's state and update the `TRACES` binding:

```sh
alchemy state cat traces/prod/App --backend cloudflare | grep workerName
```

## Deploying

```sh
mise run deploy:router
```

`mise run deploy` runs it too. Worker routes take precedence over custom domains, so if `just-be.dev` is a custom domain on the site Worker, the first deploy moves all apex traffic onto the router. Deploy the site first so `/fragments/header/` exists, and deploy Traces first so `/traces` gets the bold font and skip-link target. To roll back, delete the router's route, and the site Worker serves the apex directly again.

## Development

```sh
bun test services/router
```

To run it against real Workers, start each one in its own `wrangler dev` session (with its own `--port` and `--inspector-port`), then `bun run dev` here. The router finds them through wrangler's local dev registry by Worker name.

- Site: `mise run build`, then `wrangler dev -c dist/server/wrangler.json`.
- Traces: `alchemy dev` uses a different Worker name, so stand in with its build. Run `mise run build` in the traces repo and serve its `dist/` from a small Worker named like the `TRACES` binding, whose `fetch` returns `env.ASSETS.fetch(request)` and whose assets use `not_found_handling = "single-page-application"`.

Don't run them from one multi-config `wrangler dev` session. In the wrangler versions tested, that serves the wrong Worker's static assets.
