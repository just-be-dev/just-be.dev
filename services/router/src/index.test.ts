import { describe, expect, it } from "bun:test";
import router, { type Env } from "./index";
import { matchRoute, parseRouterConfig, stripMount } from "./config";
import { bodyKind, rewriteCss, rewriteLocation, rewriteSetCookie } from "./rewrite";

const ROUTES = JSON.stringify({
  routes: [
    { path: "/traces", binding: "TRACES", header: true },
    { path: "/", binding: "SITE" },
  ],
  header: { binding: "SITE", path: "/fragments/header/" },
});

const HEADER = '<site-header><a href="/blog">blog</a></site-header>';

const TRACES_PAGE = `<!doctype html><html><head>
<script type="module" crossorigin src="/assets/index.js"></script>
<link rel="stylesheet" href="/assets/index.css">
</head><body><div id="root"></div>
<a href="/install">install</a><a href="https://example.com/x">external</a><a href="//cdn.example/x">cdn</a>
<img srcset="/assets/a.png 1x, /assets/b.png 2x"><form action="/api/ingest"></form>
</body></html>`;

type Handler = (request: Request) => Response | Promise<Response>;

function fetcher(handler: Handler) {
  const requests: Request[] = [];
  return {
    requests,
    binding: {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        requests.push(request);
        return handler(request);
      },
    } as unknown as Fetcher,
  };
}

function html(body: string, headers: Record<string, string> = {}) {
  return new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8", etag: '"abc"', ...headers },
  });
}

function setup(options: { site?: Handler; traces?: Handler } = {}) {
  const site = fetcher(
    options.site ??
      ((request) => {
        const { pathname } = new URL(request.url);
        if (pathname === "/fragments/header/") return html(HEADER);
        return html(`<html><body><a href="/blog">site ${pathname}</a></body></html>`);
      }),
  );
  const traces = fetcher(
    options.traces ??
      ((request) => {
        const { pathname } = new URL(request.url);
        if (pathname === "/assets/index.css") {
          return new Response(
            '@font-face{src:url(/assets/inter.woff2)}a{background:url("//cdn/x.png")}',
            {
              headers: { "content-type": "text/css", "content-length": "80" },
            },
          );
        }
        if (pathname === "/old") {
          return new Response(null, { status: 302, headers: { location: "/new?x=1" } });
        }
        if (pathname === "/cookie") {
          const headers = new Headers({ "content-type": "text/plain" });
          headers.append("set-cookie", "a=1; Path=/; HttpOnly");
          headers.append("set-cookie", "b=2");
          return new Response("ok", { headers });
        }
        if (pathname === "/install") {
          return new Response("# Install <a href='/x'>", {
            headers: { "content-type": "text/markdown" },
          });
        }
        return html(TRACES_PAGE);
      }),
  );
  const env: Env = { ROUTES, SITE: site.binding, TRACES: traces.binding };
  const fetch = (path: string, init?: RequestInit) =>
    router.fetch(new Request(`https://just-be.dev${path}`, init), env);
  return { site, traces, fetch };
}

describe("config", () => {
  const { routes } = parseRouterConfig(ROUTES);

  it("matches the longest mount on segment boundaries", () => {
    expect(matchRoute(routes, "/traces")?.binding).toBe("TRACES");
    expect(matchRoute(routes, "/traces/")?.binding).toBe("TRACES");
    expect(matchRoute(routes, "/traces/install")?.binding).toBe("TRACES");
    expect(matchRoute(routes, "/tracesx")?.binding).toBe("SITE");
    expect(matchRoute(routes, "/blog/post")?.binding).toBe("SITE");
  });

  it("strips the mount so the app sees itself at the root", () => {
    expect(stripMount("/traces", "/traces")).toBe("/");
    expect(stripMount("/traces", "/traces/")).toBe("/");
    expect(stripMount("/traces", "/traces/install/x")).toBe("/install/x");
    expect(stripMount("/", "/blog")).toBe("/blog");
  });

  it("rejects invalid configuration", () => {
    expect(() => parseRouterConfig({ routes: [] })).toThrow();
    expect(() => parseRouterConfig({ routes: [{ path: "/traces/", binding: "T" }] })).toThrow();
    expect(() =>
      parseRouterConfig({
        routes: [
          { path: "/a", binding: "A" },
          { path: "/a", binding: "B" },
        ],
      }),
    ).toThrow();
    expect(() =>
      parseRouterConfig({ routes: [{ path: "/a", binding: "A", header: true }] }),
    ).toThrow(/header/);
  });
});

describe("rewriting", () => {
  it("classifies bodies by media type, ignoring parameters and case", () => {
    const kind = (contentType?: string) =>
      bodyKind(new Response("", contentType ? { headers: { "content-type": contentType } } : {}));
    expect(kind("text/html")).toBe("html");
    expect(kind("Text/HTML; charset=utf-8")).toBe("html");
    expect(kind(" text/css ;charset=utf-8")).toBe("css");
    expect(kind("application/xhtml+xml")).toBe("other");
    expect(kind("text/markdown; charset=utf-8")).toBe("other");
    expect(kind("text/plain; note=text/html")).toBe("other");
    expect(kind()).toBe("other");
  });

  it("prefixes root-relative CSS urls only", () => {
    expect(
      rewriteCss("/t", "a{b:url(/x.png)} c{d:url('/y.svg')} e{f:url(//cdn/z)} g{h:url(rel.png)}"),
    ).toBe("a{b:url(/t/x.png)} c{d:url('/t/y.svg')} e{f:url(//cdn/z)} g{h:url(rel.png)}");
  });

  it("prefixes same-origin redirects only", () => {
    const url = new URL("https://just-be.dev/traces/old");
    expect(rewriteLocation("/traces", "/new?x=1#h", url)).toBe("/traces/new?x=1#h");
    expect(rewriteLocation("/traces", "https://just-be.dev/new", url)).toBe("/traces/new");
    expect(rewriteLocation("/traces", "https://traces.just-be.dev/new", url)).toBe(
      "https://traces.just-be.dev/new",
    );
  });

  it("scopes cookies to the mount", () => {
    expect(rewriteSetCookie("/traces", "a=1; Path=/; HttpOnly")).toBe(
      "a=1; Path=/traces; HttpOnly",
    );
    expect(rewriteSetCookie("/traces", "a=1; path=/api")).toBe("a=1; path=/traces/api");
    expect(rewriteSetCookie("/traces", "a=1")).toBe("a=1; Path=/traces");
  });
});

describe("router", () => {
  it("passes root requests to the site untouched", async () => {
    const { site, traces, fetch } = setup();
    const response = await fetch("/blog?x=1");
    expect(await response.text()).toContain("site /blog");
    expect(site.requests[0]?.url).toBe("https://just-be.dev/blog?x=1");
    expect(site.requests[0]?.headers.has("x-forwarded-prefix")).toBe(false);
    expect(traces.requests).toHaveLength(0);
  });

  it("forwards mounted requests with the mount stripped and forwarding headers", async () => {
    const { traces, fetch } = setup();
    await fetch("/traces/install?q=1", {
      method: "POST",
      body: "{}",
      headers: { "x-forwarded-prefix": "/evil" },
    });
    const request = traces.requests[0]!;
    expect(request.url).toBe("https://just-be.dev/install?q=1");
    expect(request.method).toBe("POST");
    expect(await request.text()).toBe("{}");
    expect(request.headers.get("x-forwarded-prefix")).toBe("/traces");
    expect(request.headers.get("x-forwarded-host")).toBe("just-be.dev");
    expect(request.headers.get("x-forwarded-proto")).toBe("https");
  });

  it("serves the mount root for the bare mount path", async () => {
    const { traces, fetch } = setup();
    await fetch("/traces");
    expect(new URL(traces.requests[0]!.url).pathname).toBe("/");
  });

  it("rewrites mounted HTML and injects the shared header once", async () => {
    const { fetch } = setup();
    const response = await fetch("/traces");
    const body = await response.text();
    expect(body).toContain('src="/traces/assets/index.js"');
    expect(body).toContain('href="/traces/assets/index.css"');
    expect(body).toContain('href="/traces/install"');
    expect(body).toContain('href="https://example.com/x"');
    expect(body).toContain('href="//cdn.example/x"');
    expect(body).toContain('srcset="/traces/assets/a.png 1x, /traces/assets/b.png 2x"');
    expect(body).toContain('action="/traces/api/ingest"');
    // The header lands first in <body>, and its links still point at the root site.
    expect(body).toContain(`<body>${HEADER}<div id="root">`);
    expect(body.split("<site-header>")).toHaveLength(2);
    expect(response.headers.get("etag")).toBeNull();
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  it("serves the page without the header when the fragment fails", async () => {
    const { fetch } = setup({ site: () => new Response("boom", { status: 500 }) });
    const response = await fetch("/traces/");
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).not.toContain("site-header");
    expect(body).toContain('src="/traces/assets/index.js"');
    expect(response.headers.get("etag")).toBe('"abc"');
  });

  it("serves the page without the header when the fragment binding throws", async () => {
    const { fetch } = setup({
      site: () => {
        throw new Error("network");
      },
    });
    const response = await fetch("/traces");
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("site-header");
  });

  it("rewrites mounted CSS urls and drops the stale length", async () => {
    const { fetch } = setup();
    const response = await fetch("/traces/assets/index.css");
    expect(await response.text()).toBe(
      '@font-face{src:url(/traces/assets/inter.woff2)}a{background:url("//cdn/x.png")}',
    );
    expect(response.headers.get("content-length")).not.toBe("80");
  });

  it("rewrites mounted redirects and cookies", async () => {
    const { fetch } = setup();
    const redirect = await fetch("/traces/old");
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe("/traces/new?x=1");

    const cookie = await fetch("/traces/cookie");
    expect(cookie.headers.getSetCookie()).toEqual([
      "a=1; Path=/traces; HttpOnly",
      "b=2; Path=/traces",
    ]);
  });

  it("leaves non-HTML, non-CSS bodies alone", async () => {
    const { fetch } = setup();
    expect(await (await fetch("/traces/install")).text()).toBe("# Install <a href='/x'>");
  });

  it("passes HEAD responses through without a body", async () => {
    const { fetch } = setup();
    const response = await fetch("/traces", { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
});
