/**
 * Joins Desk's public projects with the MDX prose in `src/content/projects/`.
 *
 * - Desk owns the short code, name, description, state, experimental and the
 *   url/github links.
 * - MDX owns the long-form prose, plus optional presentation overrides
 *   (title, description, date) and `slugs` aliases.
 * - A Desk project's `site` link names its MDX file (`site: pex` -> `pex.mdx`).
 *
 * Pure: no Astro or Workers imports, so it can be unit tested.
 */
import type { DeskResult, PlatformProject, ProjectState } from "./desk";

/** The fields of a `projects` collection entry this module reads. */
export interface MdxProject {
  id: string;
  data: {
    title?: string;
    description?: string;
    date?: Date;
    slugs?: string[];
  };
}

export interface SiteProject<Entry extends MdxProject = MdxProject> {
  /** Page path segment: /projects/<slug>. */
  slug: string;
  title: string;
  description?: string;
  date?: Date;
  /** Upper-case short code from Desk. Undefined when Desk is unavailable. */
  code?: string;
  /** Undefined when Desk is unavailable. */
  state?: ProjectState;
  experimental: boolean;
  /** Homepage (Desk `url` link). */
  url?: string;
  /** GitHub URL (Desk `github` link). */
  github?: string;
  entry?: Entry;
  desk?: PlatformProject;
}

export interface SiteProjects<Entry extends MdxProject = MdxProject> {
  /** False when Desk couldn't be reached and nothing was cached. */
  deskAvailable: boolean;
  /** Every project that has a page. */
  projects: SiteProject<Entry>[];
}

/** Index order. `idea` projects are not listed. */
export const LISTED_STATES: readonly ProjectState[] = ["active", "maintenance", "done", "archived"];

function linkRef(project: PlatformProject, kind: string): string | undefined {
  return project.links.find((link) => link.kind === kind)?.ref;
}

const sameUrl = (a: string, b: string) =>
  a.replace(/\/+$/, "").toLowerCase() === b.replace(/\/+$/, "").toLowerCase();

function fromDesk<Entry extends MdxProject>(
  project: PlatformProject,
  slug: string,
  entry: Entry | undefined,
): SiteProject<Entry> {
  const githubRef = linkRef(project, "github");
  const github = githubRef ? `https://github.com/${githubRef}` : undefined;
  const url = linkRef(project, "url");
  return {
    slug,
    title: entry?.data.title ?? project.name,
    description: entry?.data.description ?? project.description ?? undefined,
    date: entry?.data.date ?? new Date(project.createdAt),
    code: project.code.toUpperCase(),
    state: project.state,
    experimental: project.experimental,
    // A `url` link that is just the GitHub page adds nothing to the github link.
    url: url && !(github && sameUrl(url, github)) ? url : undefined,
    github,
    entry,
    desk: project,
  };
}

function fromMdxOnly<Entry extends MdxProject>(entry: Entry): SiteProject<Entry> {
  return {
    slug: entry.id,
    // Without Desk there is no name; the slug reads fine in a TUI.
    title: entry.data.title ?? entry.id,
    description: entry.data.description,
    date: entry.data.date,
    experimental: false,
    entry,
  };
}

/**
 * Build the site's projects from Desk and MDX.
 *
 * When Desk answered, only its public projects have pages; an MDX file with no
 * public Desk project is hidden. When Desk is unavailable, every MDX file gets
 * a page without state, so the site degrades to its prose instead of failing.
 */
export function joinProjects<Entry extends MdxProject>(
  desk: DeskResult,
  entries: Entry[],
  warn: (message: string) => void = () => {},
): SiteProjects<Entry> {
  if (!desk.ok) {
    return { deskAvailable: false, projects: entries.map(fromMdxOnly) };
  }

  const bySlug = new Map(entries.map((entry) => [entry.id, entry]));
  const taken = new Set<string>();
  const projects: SiteProject<Entry>[] = [];

  // Projects that point at an MDX file claim their slugs first, so a Desk-only
  // project can't take a slug an MDX page owns.
  const linked = desk.projects.filter((p) => linkRef(p, "site"));
  const unlinked = desk.projects.filter((p) => !linkRef(p, "site"));

  for (const project of [...linked, ...unlinked]) {
    const site = linkRef(project, "site");
    const slug = site ?? project.slug;
    if (taken.has(slug) || (!site && bySlug.has(slug))) {
      warn(`Desk project ${project.id} (${project.slug}) can't use slug "${slug}", skipping`);
      continue;
    }
    const entry = site ? bySlug.get(site) : undefined;
    if (site && !entry) {
      warn(`Desk project ${project.id} links to site "${site}", which has no MDX file`);
    }
    taken.add(slug);
    projects.push(fromDesk(project, slug, entry));
  }

  return { deskAvailable: true, projects };
}

/** Projects shown on /projects: by state (archived last, ideas hidden), then newest first. */
export function listProjects<Entry extends MdxProject>(
  projects: SiteProject<Entry>[],
): SiteProject<Entry>[] {
  const rank = (project: SiteProject<Entry>) =>
    project.state ? LISTED_STATES.indexOf(project.state) : 0;

  return projects
    .filter((project) => rank(project) !== -1)
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (b.date?.valueOf() ?? 0) - (a.date?.valueOf() ?? 0) ||
        a.title.localeCompare(b.title),
    );
}

/**
 * Where a project short code (`/p2530`, any case) redirects: the page of the
 * project with that code, using the slug the join picked. Undefined when no
 * project with a page has the code (unknown, not public in Desk, or Desk is
 * unavailable and projects have no codes).
 */
export function projectCodePath(
  code: string,
  projects: Pick<SiteProject, "slug" | "code">[],
): string | undefined {
  const upper = code.toUpperCase();
  const project = projects.find((p) => p.code === upper);
  return project ? `/projects/${project.slug}` : undefined;
}

/**
 * Where a project alias (an MDX `slugs` entry such as `/pex`) redirects, or
 * undefined if `pathname` isn't one. An MDX file's page is always
 * `/projects/<file name>`, so this needs no Desk data.
 */
export function projectAliasPath(pathname: string, entries: MdxProject[]): string | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const entry = entries.find((e) => e.data.slugs?.includes(normalized));
  if (!entry) return undefined;
  const target = `/projects/${entry.id}`;
  return target !== normalized ? target : undefined;
}
