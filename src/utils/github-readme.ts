/**
 * Fetches and renders a GitHub repository's README for the `readme` live
 * collection (`::readme{repo="owner/name"}` in MDX).
 *
 * READMEs come from raw.githubusercontent.com, not the REST API. The API's
 * unauthenticated limit is 60 requests an hour per IP, and Cloudflare's egress
 * IPs share it with every other Worker, so API calls from production often got
 * 403s. `HEAD` resolves to the default branch for both raw files and
 * github.com/blob links, so the API isn't needed at all.
 *
 * No Astro or Workers imports, so it can be unit tested.
 */
import { Marked, Renderer, type Tokens } from "marked";

const defaults = Renderer.prototype;

export const USER_AGENT = "just-be-dev-website";
/** Resolves to the default branch on raw.githubusercontent.com and github.com. */
export const DEFAULT_REF = "HEAD";
const README_NAMES = ["README.md", "readme.md", "Readme.md", "README.markdown", "README"];

/** True for hrefs that point into the repository rather than elsewhere. */
function isRepoRelative(href: string): boolean {
  return !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href);
}

function repoPath(href: string): string {
  return href.replace(/^(\.\/|\/)+/, "");
}

const NEW_TAB = 'target="_blank" rel="noopener noreferrer"';

/** Render README markdown to HTML with links and images pointing at GitHub. */
export function renderReadme(markdown: string, owner: string, repo: string): string {
  const blob = (path: string) => `https://github.com/${owner}/${repo}/blob/${DEFAULT_REF}/${path}`;
  const raw = (path: string) =>
    `https://raw.githubusercontent.com/${owner}/${repo}/${DEFAULT_REF}/${path}`;

  const marked = new Marked({
    gfm: true,
    // Match GitHub: single newlines within a paragraph collapse to spaces.
    breaks: false,
    // Renderer overrides run with `this` as marked's renderer, so they can
    // defer to the default output with an adjusted token.
    renderer: {
      link(token: Tokens.Link) {
        const href = token.href;
        if (!href || href.startsWith("#")) return false;
        const adjusted = isRepoRelative(href) ? { ...token, href: blob(repoPath(href)) } : token;
        return defaults.link.call(this, adjusted).replace(/^<a /, `<a ${NEW_TAB} `);
      },
      image(token: Tokens.Image) {
        if (!token.href || !isRepoRelative(token.href)) return false;
        return defaults.image.call(this, { ...token, href: raw(repoPath(token.href)) });
      },
    },
    walkTokens(token) {
      // Raw HTML in READMEs (centered logos and the like): point relative
      // `src` attributes at the raw file.
      if (token.type === "html") {
        token.text = token.text.replace(
          /(\ssrc=["'])([^"']+)(["'])/gi,
          (match: string, start: string, src: string, end: string) =>
            isRepoRelative(src) ? `${start}${raw(repoPath(src))}${end}` : match,
        );
      }
    },
  });

  // The page already has the project's title, so drop the README's first H1.
  const body = markdown.replace(/^\uFEFF?#\s+.*?(\r?\n)+/, "");
  return marked.parse(body, { async: false });
}

export type ReadmeResult =
  | { ok: true; html: string; stale: boolean }
  | { ok: false; notFound: boolean; error: string };

/** A small key/value store for rendered READMEs that outlives the isolate. */
export interface ReadmeStore {
  get(key: string): Promise<{ html: string; at: number } | undefined>;
  put(key: string, value: { html: string; at: number }): Promise<void>;
}

export interface ReadmeFetcherOptions {
  fetch?: typeof fetch;
  /** Shared store (the Workers Cache API in production). */
  store?: ReadmeStore;
  /** How long a rendered README is reused without asking GitHub. */
  freshMs?: number;
  /** How long a rendered README may be served while GitHub is failing. */
  staleMs?: number;
  timeoutMs?: number;
  now?: () => number;
  warn?: (message: string) => void;
}

class NotFound extends Error {}

/** GitHub owner and repository names: letters, digits, `-`, `_` and `.`. */
const GITHUB_NAME = /^[A-Za-z0-9_.-]{1,100}$/;

export function isValidRepo(owner: string, repo: string): boolean {
  return (
    GITHUB_NAME.test(owner) && GITHUB_NAME.test(repo) && !/^\.+$/.test(owner) && !/^\.+$/.test(repo)
  );
}

/**
 * Fetch + render with caching: an in-isolate map and an optional shared store,
 * both fresh for `freshMs`; on any failure other than a missing README, the
 * last good copy is served for up to `staleMs`.
 */
export function createReadmeFetcher(options: ReadmeFetcherOptions = {}) {
  const {
    fetch: doFetch = (input, init) => fetch(input, init),
    store,
    freshMs = 10 * 60_000,
    staleMs = 7 * 24 * 60 * 60_000,
    timeoutMs = 5_000,
    now = Date.now,
    warn = (message) => console.warn(`[readme] ${message}`),
  } = options;

  const memory = new Map<string, { html: string; at: number }>();
  const inflight = new Map<string, Promise<ReadmeResult>>();

  async function fetchMarkdown(owner: string, repo: string): Promise<string> {
    for (const name of README_NAMES) {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${DEFAULT_REF}/${name}`;
      // `cf` asks Cloudflare's edge to cache the subrequest, sharing it across
      // isolates in a colo. Ignored outside Workers.
      const init: RequestInit & { cf?: Record<string, unknown> } = {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
        cf: {
          cacheEverything: true,
          cacheTtlByStatus: { "200-299": 600, "404": 60, "500-599": 0 },
        },
      };
      const response = await doFetch(url, init);
      if (response.ok) return response.text();
      await response.body?.cancel();
      if (response.status !== 404) {
        throw new Error(`GitHub returned ${response.status} for ${owner}/${repo}/${name}`);
      }
    }
    throw new NotFound(`README not found for ${owner}/${repo}`);
  }

  async function storeGet(key: string) {
    try {
      return await store?.get(key);
    } catch (error) {
      warn(`cache read failed for ${key}: ${String(error)}`);
      return undefined;
    }
  }

  async function load(owner: string, repo: string): Promise<ReadmeResult> {
    const key = `${owner}/${repo}`.toLowerCase();

    const cached = memory.get(key) ?? (await storeGet(key));
    if (cached) memory.set(key, cached);
    if (cached && now() - cached.at < freshMs) {
      return { ok: true, html: cached.html, stale: false };
    }

    try {
      const html = renderReadme(await fetchMarkdown(owner, repo), owner, repo);
      const value = { html, at: now() };
      memory.set(key, value);
      try {
        await store?.put(key, value);
      } catch (error) {
        warn(`cache write failed for ${key}: ${String(error)}`);
      }
      return { ok: true, html, stale: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof NotFound) {
        memory.delete(key);
        return { ok: false, notFound: true, error: message };
      }
      warn(`fetch failed for ${key}: ${message}`);
      if (cached && now() - cached.at < staleMs) {
        return { ok: true, html: cached.html, stale: true };
      }
      return { ok: false, notFound: false, error: message };
    }
  }

  return {
    get(owner: string, repo: string): Promise<ReadmeResult> {
      // The only outbound host is raw.githubusercontent.com; refuse names that
      // could change the path.
      if (!isValidRepo(owner, repo)) {
        return Promise.resolve({
          ok: false,
          notFound: true,
          error: `Invalid repository ${owner}/${repo}`,
        });
      }
      const key = `${owner}/${repo}`.toLowerCase();
      let pending = inflight.get(key);
      if (!pending) {
        pending = load(owner, repo).finally(() => inflight.delete(key));
        inflight.set(key, pending);
      }
      return pending;
    },
  };
}

/**
 * A `ReadmeStore` on the Workers Cache API, or undefined where it isn't
 * available (Bun tests, Node prerendering). Entries are kept for `staleMs`;
 * freshness is decided by the stored timestamp.
 */
export function cacheApiStore(staleMs = 7 * 24 * 60 * 60_000): ReadmeStore | undefined {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!cache) return undefined;
  const url = (key: string) => `https://just-be.dev/__readme-cache/v1/${encodeURIComponent(key)}`;
  return {
    async get(key) {
      const response = await cache.match(url(key));
      return response ? ((await response.json()) as { html: string; at: number }) : undefined;
    },
    async put(key, value) {
      await cache.put(
        url(key),
        Response.json(value, {
          headers: { "Cache-Control": `public, max-age=${Math.floor(staleMs / 1000)}` },
        }),
      );
    },
  };
}
