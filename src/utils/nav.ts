/**
 * Site navigation shared by the header component and its client script.
 *
 * The header is also served as a fragment (`/fragments/header`) that the router
 * injects into other microfrontends, so anything here must work both at build
 * time and in the browser.
 */

export interface Tab {
  href: string;
  keyChar: string;
  label: string;
}

export const tabs: Tab[] = [
  { href: "/", keyChar: "o", label: "home" },
  { href: "/blog", keyChar: "b", label: "blog" },
  { href: "/projects", keyChar: "p", label: "projects" },
  { href: "/research", keyChar: "r", label: "research" },
  { href: "/talks", keyChar: "t", label: "talks" },
  { href: "/games", keyChar: "g", label: "games" },
  { href: "/work", keyChar: "w", label: "work" },
];

/** Tag name of the header's shadow host. */
export const SITE_HEADER_TAG = "site-header";

/** The tab's section contains the path. */
export function isActive(href: string, path: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

/** The path is the tab's own page, ignoring trailing slashes. */
export function isCurrent(href: string, path: string) {
  const normalizedHref = href.replace(/\/$/, "") || "/";
  const normalizedPath = path.replace(/\/$/, "") || "/";
  return normalizedHref === normalizedPath;
}

export function highlightLabel(label: string, keyChar: string) {
  const index = label.toLowerCase().indexOf(keyChar.toLowerCase());
  if (index === -1) return { before: label, key: "", after: "" };
  return {
    before: label.slice(0, index),
    key: label.slice(index, index + 1),
    after: label.slice(index + 1),
  };
}
