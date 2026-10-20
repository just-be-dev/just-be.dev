import { describe, expect, it } from "bun:test";
import { createReadmeFetcher, isValidRepo, renderReadme, type ReadmeStore } from "./github-readme";

const quiet = () => {};

describe("renderReadme", () => {
  const html = renderReadme(
    [
      "# Title",
      "",
      "Intro [docs](./docs/guide.md), [spec](/SPEC.md), [site](https://example.com), [top](#usage).",
      "",
      "![logo](assets/logo.png) ![badge](https://img.shields.io/x.svg)",
      "",
      '<p align="center"><img src="./media/demo.gif" width="200"></p>',
      "",
      "Line one",
      "line two",
    ].join("\n"),
    "just-be-dev",
    "pex",
  );

  it("drops the first H1", () => {
    expect(html).not.toContain("<h1");
  });

  it("points relative links at github.com on the default branch", () => {
    expect(html).toContain(
      '<a target="_blank" rel="noopener noreferrer" href="https://github.com/just-be-dev/pex/blob/HEAD/docs/guide.md">docs</a>',
    );
    expect(html).toContain('href="https://github.com/just-be-dev/pex/blob/HEAD/SPEC.md"');
  });

  it("opens external links in a new tab and keeps anchors", () => {
    expect(html).toContain(
      '<a target="_blank" rel="noopener noreferrer" href="https://example.com">site</a>',
    );
    expect(html).toContain('<a href="#usage">top</a>');
  });

  it("points relative images, including raw HTML, at raw.githubusercontent.com", () => {
    expect(html).toContain(
      'src="https://raw.githubusercontent.com/just-be-dev/pex/HEAD/assets/logo.png"',
    );
    expect(html).toContain('src="https://img.shields.io/x.svg"');
    expect(html).toContain(
      'src="https://raw.githubusercontent.com/just-be-dev/pex/HEAD/media/demo.gif"',
    );
  });

  it("collapses single newlines like GitHub", () => {
    expect(html).toContain("Line one\nline two");
    expect(html).not.toContain("<br>");
  });
});

describe("isValidRepo", () => {
  it("accepts GitHub names and rejects path tricks", () => {
    expect(isValidRepo("just-be-dev", "just-be.dev")).toBe(true);
    expect(isValidRepo("just-be-dev", "../x")).toBe(false);
    expect(isValidRepo("just-be-dev", "..")).toBe(false);
    expect(isValidRepo("a/b", "c")).toBe(false);
  });
});

type Handler = (url: string) => Response | Promise<Response>;

function fakeFetch(handler: Handler) {
  const urls: string[] = [];
  const doFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    return handler(url);
  }) as typeof fetch;
  return { doFetch, urls };
}

function memoryStore(): ReadmeStore & { data: Map<string, { html: string; at: number }> } {
  const data = new Map<string, { html: string; at: number }>();
  return {
    data,
    get: async (key) => data.get(key),
    put: async (key, value) => void data.set(key, value),
  };
}

describe("createReadmeFetcher", () => {
  it("fetches from raw.githubusercontent.com, never the API", async () => {
    const { doFetch, urls } = fakeFetch(() => new Response("# T\n\nHello"));
    const readmes = createReadmeFetcher({ fetch: doFetch, warn: quiet });
    expect(await readmes.get("just-be-dev", "pex")).toMatchObject({ ok: true, stale: false });
    expect(urls).toEqual(["https://raw.githubusercontent.com/just-be-dev/pex/HEAD/README.md"]);
  });

  it("tries other README names on 404", async () => {
    const { doFetch, urls } = fakeFetch((url) =>
      url.endsWith("/readme.md") ? new Response("hi") : new Response("", { status: 404 }),
    );
    const readmes = createReadmeFetcher({ fetch: doFetch, warn: quiet });
    expect(await readmes.get("o", "r")).toMatchObject({ ok: true });
    expect(urls.map((u) => u.split("/").pop())).toEqual(["README.md", "readme.md"]);
  });

  it("reports a missing README as not found", async () => {
    const { doFetch } = fakeFetch(() => new Response("", { status: 404 }));
    const readmes = createReadmeFetcher({ fetch: doFetch, warn: quiet });
    expect(await readmes.get("o", "r")).toMatchObject({ ok: false, notFound: true });
  });

  it("reuses a fresh copy and shares in-flight requests", async () => {
    let now = 0;
    const { doFetch, urls } = fakeFetch(() => new Response("hi"));
    const readmes = createReadmeFetcher({ fetch: doFetch, now: () => now, warn: quiet });
    await Promise.all([readmes.get("o", "r"), readmes.get("o", "r")]);
    now = 9 * 60_000;
    await readmes.get("o", "r");
    expect(urls).toHaveLength(1);
    now = 11 * 60_000;
    await readmes.get("o", "r");
    expect(urls).toHaveLength(2);
  });

  it("serves the last good copy when GitHub fails", async () => {
    let now = 0;
    let status = 200;
    const { doFetch } = fakeFetch(() =>
      status === 200 ? new Response("hello") : new Response("", { status }),
    );
    const readmes = createReadmeFetcher({ fetch: doFetch, now: () => now, warn: quiet });
    await readmes.get("o", "r");

    status = 429;
    now = 60 * 60_000;
    expect(await readmes.get("o", "r")).toMatchObject({ ok: true, stale: true });

    now = 8 * 24 * 60 * 60_000;
    expect(await readmes.get("o", "r")).toMatchObject({ ok: false, notFound: false });
  });

  it("falls back to the shared store in a new isolate", async () => {
    const store = memoryStore();
    const ok = fakeFetch(() => new Response("hello"));
    await createReadmeFetcher({ fetch: ok.doFetch, store, now: () => 0, warn: quiet }).get(
      "o",
      "r",
    );
    expect(store.data.has("o/r")).toBe(true);

    // A fresh isolate (empty memory) while GitHub is down.
    const down = fakeFetch(() => {
      throw new Error("network down");
    });
    const result = await createReadmeFetcher({
      fetch: down.doFetch,
      store,
      now: () => 30 * 60_000,
      warn: quiet,
    }).get("o", "r");
    expect(result).toMatchObject({ ok: true, stale: true });
    expect(result.ok && result.html).toContain("hello");
  });

  it("uses a fresh store copy without calling GitHub", async () => {
    const store = memoryStore();
    store.data.set("o/r", { html: "<p>cached</p>", at: 0 });
    const { doFetch, urls } = fakeFetch(() => new Response("new"));
    const result = await createReadmeFetcher({
      fetch: doFetch,
      store,
      now: () => 60_000,
      warn: quiet,
    }).get("o", "r");
    expect(result).toMatchObject({ ok: true, html: "<p>cached</p>" });
    expect(urls).toHaveLength(0);
  });

  it("rejects invalid repository names without fetching", async () => {
    const { doFetch, urls } = fakeFetch(() => new Response("x"));
    const readmes = createReadmeFetcher({ fetch: doFetch, warn: quiet });
    expect(await readmes.get("o", "../../x")).toMatchObject({ ok: false, notFound: true });
    expect(urls).toHaveLength(0);
  });
});
