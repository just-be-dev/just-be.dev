/**
 * just-be.dev microfrontend router.
 *
 * Owns the `just-be.dev/*` route and sends each request to the Worker mounted at
 * the longest matching path, over a service binding. Mounted apps are written for
 * `/`: the router strips the mount before forwarding and prefixes root-relative
 * URLs in their HTML, CSS, redirects, and cookies on the way back. Routes with
 * `header` get the site header fragment injected at the top of every HTML page.
 *
 * See https://developers.cloudflare.com/workers/framework-guides/web-apps/microfrontends/
 */
import { matchRoute, parseRouterConfig, stripMount, type RouterConfig } from "./config";
import { rewriteCss, rewriteHtml, rewriteLocation, rewriteSetCookie } from "./rewrite";

export interface Env {
  /** JSON {@link RouterConfig}. */
  ROUTES: string;
  [binding: string]: unknown;
}

let cached: { raw: string; config: RouterConfig } | undefined;

function config(env: Env): RouterConfig {
  if (cached?.raw !== env.ROUTES)
    cached = { raw: env.ROUTES, config: parseRouterConfig(env.ROUTES) };
  return cached.config;
}

function service(env: Env, name: string): Fetcher {
  const binding = env[name] as Fetcher | undefined;
  if (!binding || typeof binding.fetch !== "function") {
    throw new Error(`ROUTES names a missing service binding: ${name}`);
  }
  return binding;
}

function isHtml(response: Response) {
  return response.headers.get("content-type")?.toLowerCase().includes("text/html") ?? false;
}

function isCss(response: Response) {
  return response.headers.get("content-type")?.toLowerCase().includes("text/css") ?? false;
}

/** The header fragment, or `undefined` if it can't be loaded; the page is served without it. */
async function loadHeader(env: Env, settings: NonNullable<RouterConfig["header"]>, url: URL) {
  try {
    const response = await service(env, settings.binding).fetch(
      new Request(new URL(settings.path, url), { headers: { accept: "text/html" } }),
    );
    if (!response.ok) {
      console.warn("Header fragment unavailable", { status: response.status });
      return undefined;
    }
    return await response.text();
  } catch (error) {
    console.warn("Header fragment unavailable", { error: String(error) });
    return undefined;
  }
}

/** Forwards to a mounted app with the mount stripped, so the app sees itself at `/`. */
function forward(request: Request, mount: string, url: URL): Request {
  const upstream = new URL(url);
  upstream.pathname = stripMount(mount, url.pathname);
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(/:$/, ""));
  headers.set("x-forwarded-prefix", mount);
  return new Request(upstream, {
    method: request.method,
    headers,
    body: request.body,
    redirect: "manual",
  });
}

async function serveMount(
  request: Request,
  env: Env,
  route: RouterConfig["routes"][number],
  settings: RouterConfig,
  url: URL,
): Promise<Response> {
  const mount = route.path;
  const upstream = await service(env, route.binding).fetch(forward(request, mount, url));

  const headers = new Headers(upstream.headers);
  const location = headers.get("location");
  if (location) headers.set("location", rewriteLocation(mount, location, url));
  const cookies = upstream.headers.getSetCookie();
  if (cookies.length > 0) {
    headers.delete("set-cookie");
    for (const cookie of cookies) headers.append("set-cookie", rewriteSetCookie(mount, cookie));
  }

  const init = { status: upstream.status, statusText: upstream.statusText, headers };
  if (!upstream.body || request.method === "HEAD") return new Response(null, init);

  if (isCss(upstream)) {
    headers.delete("content-length");
    return new Response(rewriteCss(mount, await upstream.text()), init);
  }

  if (isHtml(upstream)) {
    headers.delete("content-length");
    const header =
      route.header && settings.header ? await loadHeader(env, settings.header, url) : undefined;
    if (header !== undefined) {
      // The page now also depends on the header's version, so validators from the
      // mounted app alone would let browsers keep a stale header.
      headers.delete("etag");
      headers.delete("last-modified");
    }
    return rewriteHtml(mount, new Response(upstream.body, init), header);
  }

  return new Response(upstream.body, init);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const settings = config(env);
    const url = new URL(request.url);
    const route = matchRoute(settings.routes, url.pathname);
    if (!route) return new Response("Not found", { status: 404 });
    if (route.path === "/") return service(env, route.binding).fetch(request);
    return serveMount(request, env, route, settings, url);
  },
} satisfies ExportedHandler<Env>;
