/**
 * Stand-in for Desk's `listPublicProjects()` in local dev (`mise run dev`).
 * It mirrors the projects backfilled into Desk, with the codes Desk backfilled
 * from MDX, plus a few Desk-only projects (with their own codes, e.g.
 * /p24dd) to exercise the paths without MDX. Never used in production.
 */
import type { PlatformProject } from "./desk";

const day = (date: string) => Date.parse(`${date}T00:00:00Z`);

function project(
  slug: string,
  fields: Partial<PlatformProject> & Pick<PlatformProject, "name" | "createdAt">,
): PlatformProject {
  return {
    id: `fixture-${slug}`,
    slug,
    description: null,
    state: "active",
    visibility: "public",
    experimental: false,
    links: [],
    stateAt: fields.createdAt,
    lastEntryAt: null,
    url: `https://desk.just-be.dev/projects/${slug}`,
    ...fields,
  };
}

export const deskFixture: PlatformProject[] = [
  project("ccpm", {
    code: "p252b",
    name: "CCPM",
    description: "My personal Claude Code Plugin Marketplace",
    createdAt: day("2026-01-19"),
    links: [
      { kind: "site", ref: "ccpm" },
      { kind: "github", ref: "just-be-dev/ccpm" },
    ],
  }),
  project("devtools-fm", {
    code: "p1e73",
    name: "DevTools FM",
    description: "A podcast about developer tools and the people who make them",
    createdAt: day("2021-05-05"),
    links: [
      { kind: "site", ref: "devtools-fm" },
      { kind: "url", ref: "https://devtools.fm" },
    ],
  }),
  project("jexl", {
    code: "p2424",
    name: "JEXL",
    description: "A programming language where the entire syntax is written in pure JSON",
    experimental: true,
    createdAt: day("2025-05-01"),
    links: [
      { kind: "site", ref: "jexl" },
      { kind: "url", ref: "https://jexl.just-be.dev" },
      { kind: "github", ref: "just-be-dev/jexl" },
      { kind: "repo", ref: "jexl" },
    ],
  }),
  project("pex", {
    code: "p2530",
    name: "PEX Lang",
    description:
      "A compact, Lisp-like programming language for data manipulation and transformation",
    createdAt: day("2026-01-24"),
    links: [
      { kind: "site", ref: "pex" },
      { kind: "url", ref: "https://pex.just-be.dev" },
      { kind: "github", ref: "just-be-dev/pex" },
      { kind: "repo", ref: "pex" },
    ],
  }),
  project("side-project-saturday", {
    code: "p2323",
    name: "Side Project Saturday",
    description: "A weekly meetup for working on side projects",
    createdAt: day("2024-08-17"),
    links: [
      { kind: "site", ref: "side-project-saturday" },
      { kind: "url", ref: "https://sideprojectsaturday.com" },
    ],
  }),
  project("webview-cli", {
    code: "p25b4",
    name: "webview-cli",
    description: "A webview CLI: render HTML, get back JSON",
    createdAt: day("2026-06-05"),
    links: [
      { kind: "site", ref: "webview-cli" },
      { kind: "github", ref: "just-be-dev/webview-cli" },
    ],
  }),
  project("webview", {
    code: "p3a89",
    name: "webview",
    description: "A scriptable webview framework",
    state: "maintenance",
    createdAt: day("2024-09-16"),
    links: [
      { kind: "site", ref: "webview" },
      { kind: "github", ref: "just-be-dev/webview" },
    ],
  }),
  // Desk-only projects (no MDX), to exercise the minimal page and other states.
  project("fixture-desk-only", {
    code: "p24dd",
    name: "Fixture: Desk-only",
    description: "A public Desk project with no MDX file (fixture data)",
    state: "done",
    createdAt: day("2025-11-02"),
    links: [{ kind: "url", ref: "https://example.com" }],
  }),
  project("fixture-archived", {
    code: "p2119",
    name: "Fixture: Archived",
    description: "An archived Desk project (fixture data)",
    state: "archived",
    createdAt: day("2023-03-14"),
    links: [{ kind: "github", ref: "just-be-dev/just-be.dev" }],
  }),
  project("fixture-idea", {
    code: "p2538",
    name: "Fixture: Idea",
    description: "A public idea; not listed on /projects (fixture data)",
    state: "idea",
    createdAt: day("2026-02-01"),
  }),
];
