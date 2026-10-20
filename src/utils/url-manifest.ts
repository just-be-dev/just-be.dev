import { KIND_TO_COLLECTION, VALID_KINDS, type Kind } from "./code";

/** One URL manifest entry: a path (`/projects/pex`, `/pex`) and its content code. */
export interface ManifestPath {
  id: string;
  data: { code: string };
}

/**
 * The canonical page for a content code: the newest manifest path under the
 * code's collection (`p2530` -> `/projects/...`). Paths outside the collection,
 * like `/pex`, are aliases. The manifest is append-only, so a renamed file's
 * current path is the last one listed.
 */
export function canonicalPath(code: string, paths: ManifestPath[]): string | undefined {
  const lower = code.toLowerCase();
  const matching = paths.filter((p) => p.data.code.toLowerCase() === lower).map((p) => p.id);
  const kind = lower.charAt(0).toUpperCase();
  if (!VALID_KINDS.includes(kind as Kind)) return matching[0];
  const prefix = `/${KIND_TO_COLLECTION[kind as Kind]}/`;
  return matching.findLast((path) => path.startsWith(prefix)) ?? matching[0];
}

/**
 * Where an alias path (a frontmatter `slugs` entry such as `/pex`) should
 * redirect, or undefined if `pathname` isn't an alias.
 */
export function aliasTarget(pathname: string, paths: ManifestPath[]): string | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const entry = paths.find((p) => p.id === normalized);
  if (!entry) return undefined;
  const target = canonicalPath(entry.data.code, paths);
  return target && target !== normalized ? target : undefined;
}
