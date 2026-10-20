/**
 * Loads the site's projects at request time: Desk's public projects (through
 * the `DESK` service binding) joined with the MDX in `src/content/projects/`.
 * See `projects.ts` for the join rules and `desk.ts` for caching.
 *
 * In `astro dev` the binding isn't called unless `DESK_DEV=remote`:
 * - `DESK_DEV` unset or `fixture`: fixture data from `desk-fixture.ts`
 * - `DESK_DEV=remote`: the real binding (`mise run dev:desk`, a remote binding)
 * - `DESK_DEV=unavailable`: behave as if Desk is down
 */
import { env } from "cloudflare:workers";
import { getCollection, type CollectionEntry } from "astro:content";
import { createDeskClient, type DeskPlatformBinding, type DeskResult } from "./desk";
import { deskFixture } from "./desk-fixture";
import { joinProjects, type SiteProject, type SiteProjects } from "./projects";

export type Project = SiteProject<CollectionEntry<"projects">>;

interface DeskEnv {
  DESK?: DeskPlatformBinding;
  DESK_DEV?: string;
}

// SAFETY: the Worker env carries the `DESK` service binding from wrangler.toml
// (absent in some local setups) and an optional `DESK_DEV` string var. Both are
// checked before use, and the RPC response is validated in `desk.ts`.
const deskEnv = env as DeskEnv;

const client = createDeskClient({ binding: () => deskEnv.DESK });

async function listPublicProjects(): Promise<DeskResult> {
  if (import.meta.env.DEV) {
    const mode = deskEnv.DESK_DEV ?? "fixture";
    if (mode === "unavailable") return { ok: false, error: "DESK_DEV=unavailable" };
    if (mode !== "remote")
      return { ok: true, projects: deskFixture, source: "fixture", stale: false };
  }
  return client.listPublicProjects();
}

export async function loadProjects(): Promise<SiteProjects<CollectionEntry<"projects">>> {
  const [desk, entries] = await Promise.all([listPublicProjects(), getCollection("projects")]);
  if (!desk.ok) {
    console.warn(`[desk] Desk unavailable, rendering MDX only: ${desk.error}`);
  }
  return joinProjects(desk, entries, (message) => console.warn(`[desk] ${message}`));
}
