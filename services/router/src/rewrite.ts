/**
 * Rewrites a mounted app's responses so the app works under its mount path
 * without knowing it. The app is written for `/`, so its root-relative URLs
 * (`/assets/app.js`) get the mount prefixed (`/traces/assets/app.js`).
 */

/** What the router rewrites in a response body. */
export type BodyKind = "html" | "css" | "other";

/** Classifies a response by its media type, the `Content-Type` value before any parameters. */
export function bodyKind(response: Response): BodyKind {
  const mediaType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (mediaType === "text/html") return "html";
  if (mediaType === "text/css") return "css";
  return "other";
}

/** Attributes whose value is a single URL. */
const URL_ATTRIBUTES = ["href", "src", "action", "formaction", "poster"] as const;
/** Attributes whose value is a list of `url descriptor` candidates. */
const SRCSET_ATTRIBUTES = ["srcset", "imagesrcset"] as const;

/** Root-relative (`/x`), but not protocol-relative (`//host/x`). */
function isRootRelative(url: string) {
  return url.startsWith("/") && !url.startsWith("//");
}

export function prefixUrl(mount: string, url: string): string {
  return isRootRelative(url) ? `${mount}${url}` : url;
}

function prefixSrcset(mount: string, srcset: string): string {
  return srcset
    .split(",")
    .map((candidate) => {
      const trimmed = candidate.trim();
      const [url = "", ...descriptors] = trimmed.split(/\s+/);
      return [prefixUrl(mount, url), ...descriptors].join(" ");
    })
    .join(", ");
}

/** Prefixes root-relative `url()` references in a stylesheet. */
export function rewriteCss(mount: string, css: string): string {
  return css.replace(
    /url\(\s*(['"]?)(\/(?!\/)[^'")]*)\1\s*\)/g,
    (_match, quote: string, url: string) => `url(${quote}${mount}${url}${quote})`,
  );
}

/**
 * Prefixes a same-origin redirect target. Cross-origin targets are left alone.
 * `requestUrl` is the URL the browser asked for, on the router's origin.
 */
export function rewriteLocation(mount: string, location: string, requestUrl: URL): string {
  const target = new URL(location, requestUrl);
  if (target.origin !== requestUrl.origin) return location;
  return `${mount}${target.pathname}${target.search}${target.hash}`;
}

/** Scopes a cookie's `Path` to the mount, so mounted apps can't collide on cookie names. */
export function rewriteSetCookie(mount: string, cookie: string): string {
  if (!/;\s*path=/i.test(cookie)) return `${cookie}; Path=${mount}`;
  return cookie.replace(/(;\s*path=)([^;]*)/i, (_match, attribute: string, path: string) => {
    const value = path.trim();
    return `${attribute}${isRootRelative(value) ? `${mount}${value === "/" ? "" : value}` : value}`;
  });
}

/**
 * Rewrites a mounted app's HTML. When `header` is given, it is inserted at the
 * top of `<body>`; inserted markup is not rewritten, so the header's links keep
 * pointing at the root site.
 */
export function rewriteHtml(mount: string, response: Response, header?: string): Response {
  let rewriter = new HTMLRewriter();
  for (const attribute of URL_ATTRIBUTES) {
    rewriter = rewriter.on(`[${attribute}]`, {
      element(element) {
        const value = element.getAttribute(attribute);
        if (value !== null) element.setAttribute(attribute, prefixUrl(mount, value));
      },
    });
  }
  for (const attribute of SRCSET_ATTRIBUTES) {
    rewriter = rewriter.on(`[${attribute}]`, {
      element(element) {
        const value = element.getAttribute(attribute);
        if (value !== null) element.setAttribute(attribute, prefixSrcset(mount, value));
      },
    });
  }
  if (header !== undefined) {
    let inserted = false;
    rewriter = rewriter.on("body", {
      element(element) {
        if (inserted) return;
        inserted = true;
        element.prepend(header, { html: true });
      },
    });
  }
  return rewriter.transform(response);
}
