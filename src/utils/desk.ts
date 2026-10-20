/**
 * Client for Desk's `DeskPlatform` RPC surface, reached through the `DESK`
 * service binding. The methods live on the default entrypoint of Desk's
 * private API Worker, so the binding has no named entrypoint. Desk (desk.just-be.dev) is the system of record for
 * projects: their short code, state, visibility, description and links. This
 * site only calls `listPublicProjects()`.
 *
 * This module has no Workers or Astro imports so it can be unit tested. The
 * wiring to `cloudflare:workers` lives in `site-projects.ts`.
 */
import { z } from "zod";

export const PROJECT_STATES = ["idea", "active", "maintenance", "done", "archived"] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

export const projectLinkSchema = z.object({
  kind: z.enum(["repo", "github", "url", "site"]),
  ref: z.string(),
});
export type ProjectLinkRef = z.infer<typeof projectLinkSchema>;

/** A project short code as Desk stores it: `p` + 4 lowercase hex digits. */
export const PROJECT_CODE_PATTERN = /^p[0-9a-f]{4}$/;

export const platformProjectSchema = z.object({
  id: z.string(),
  slug: z.string(),
  /**
   * Permanent short code (`p2530`), unique across Desk and never reused.
   * Optional until Desk ships the field; see `parsePublicProjects`.
   */
  code: z.string().optional(),
  name: z.string(),
  description: z.string().nullable(),
  state: z.enum(PROJECT_STATES),
  visibility: z.enum(["private", "public"]),
  experimental: z.boolean(),
  // Unknown link kinds (added later by Desk) are dropped rather than failing the project.
  links: z.array(z.unknown()).transform((links) =>
    links.flatMap((link) => {
      const parsed = projectLinkSchema.safeParse(link);
      return parsed.success ? [parsed.data] : [];
    }),
  ),
  createdAt: z.number(),
  stateAt: z.number(),
  lastEntryAt: z.number().nullable(),
  /** Always https://desk.just-be.dev/projects/<slug> (private; not shown on the site). */
  url: z.string(),
});
export type PlatformProject = z.infer<typeof platformProjectSchema>;

/** The slice of Desk's `DeskPlatform` surface this site uses. */
export interface DeskPlatformBinding {
  listPublicProjects(): Promise<unknown>;
}

export type DeskResult =
  | {
      ok: true;
      projects: PlatformProject[];
      source: "desk" | "fixture";
      /** True when Desk failed and a previously fetched list was served. */
      stale: boolean;
    }
  | { ok: false; error: string };

/**
 * Validate an RPC response. Desk returns errors as tagged values
 * (`{ _tag, message }`), so they are recognized structurally. Individual
 * projects that don't match the contract are dropped and reported.
 */
export function parsePublicProjects(
  value: unknown,
  warn: (message: string) => void = () => {},
): PlatformProject[] {
  if (!Array.isArray(value)) {
    if (value && typeof value === "object" && "_tag" in value) {
      const { _tag, message } = value as { _tag: unknown; message?: unknown };
      throw new Error(`Desk returned ${String(_tag)}: ${String(message ?? "")}`);
    }
    throw new Error(`Desk returned ${value === null ? "null" : typeof value}, expected an array`);
  }

  return value.flatMap((item, index) => {
    const parsed = platformProjectSchema.safeParse(item);
    if (!parsed.success) {
      warn(`Dropping Desk project #${index}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
      return [];
    }
    // Defence in depth: never show a project Desk says is private.
    if (parsed.data.visibility !== "public") return [];
    return [withValidCode(parsed.data, warn)];
  });
}

/**
 * Normalize a project's code to lowercase. A malformed code is dropped (the
 * project keeps its page, without a code) rather than dropping the project.
 */
function withValidCode(project: PlatformProject, warn: (message: string) => void): PlatformProject {
  if (project.code === undefined) return project;
  const code = project.code.toLowerCase();
  if (PROJECT_CODE_PATTERN.test(code)) return { ...project, code };
  warn(`Ignoring malformed code "${project.code}" on Desk project ${project.id}`);
  const { code: _ignored, ...rest } = project;
  return rest;
}

export interface DeskClientOptions {
  /** Returns the binding, or undefined when it isn't configured. */
  binding: () => DeskPlatformBinding | undefined;
  /** How long a successful response is served without asking Desk again. */
  freshMs?: number;
  /** How long a previous response may be served while Desk is failing. */
  staleMs?: number;
  /** After a failure, how long to skip calling Desk (serving stale or nothing). */
  retryMs?: number;
  /** Give up on a single call after this long. */
  timeoutMs?: number;
  now?: () => number;
  warn?: (message: string) => void;
}

export interface DeskClient {
  listPublicProjects(): Promise<DeskResult>;
}

/**
 * A per-isolate cached client. Requests share one in-flight call, a good
 * response is reused for `freshMs`, and while Desk is down the last good
 * response is served for up to `staleMs`. It never throws.
 */
export function createDeskClient(options: DeskClientOptions): DeskClient {
  const {
    binding,
    freshMs = 60_000,
    staleMs = 24 * 60 * 60_000,
    retryMs = 15_000,
    timeoutMs = 2_500,
    now = Date.now,
    warn = (message) => console.warn(`[desk] ${message}`),
  } = options;

  let cached: { projects: PlatformProject[]; at: number } | undefined;
  let failure: { error: string; at: number } | undefined;
  let inflight: Promise<DeskResult> | undefined;

  const fromCache = (error: string): DeskResult => {
    if (cached && now() - cached.at < staleMs) {
      return { ok: true, projects: cached.projects, source: "desk", stale: true };
    }
    return { ok: false, error };
  };

  async function call(): Promise<DeskResult> {
    const desk = binding();
    if (!desk) {
      return { ok: false, error: "The DESK binding is not configured" };
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Desk did not answer within ${timeoutMs}ms`)),
          timeoutMs,
        );
      });
      const value = await Promise.race([desk.listPublicProjects(), timeout]);
      const projects = parsePublicProjects(value, warn);
      cached = { projects, at: now() };
      failure = undefined;
      return { ok: true, projects, source: "desk", stale: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warn(`listPublicProjects failed: ${message}`);
      failure = { error: message, at: now() };
      return fromCache(message);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async listPublicProjects() {
      if (cached && now() - cached.at < freshMs) {
        return { ok: true, projects: cached.projects, source: "desk", stale: false };
      }
      if (failure && now() - failure.at < retryMs) {
        return fromCache(failure.error);
      }
      inflight ??= call().finally(() => {
        inflight = undefined;
      });
      return inflight;
    },
  };
}
