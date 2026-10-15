/** A mount path: `/` or one or more lowercase segments, without a trailing slash. */
const MOUNT_PATH = /^\/$|^(\/[a-z0-9][a-z0-9._-]*)+$/;

export interface Route {
  /** Requests to this path, or anything below it, go to `binding`. */
  path: string;
  /** Name of the service binding that serves the mount. */
  binding: string;
  /** Inject the shared site header into this mount's HTML pages. */
  header: boolean;
}

/**
 * The `ROUTES` variable, following the shape of Cloudflare's microfrontend router
 * template: https://developers.cloudflare.com/workers/framework-guides/web-apps/microfrontends/
 */
export interface RouterConfig {
  routes: Route[];
  /** Where the shared header fragment lives. Required when any route sets `header`. */
  header?: { binding: string; path: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value === "")
    throw new Error(`ROUTES: ${field} must be a non-empty string`);
  return value;
}

function parseRoute(value: unknown, index: number): Route {
  if (!isRecord(value)) throw new Error(`ROUTES: routes[${index}] must be an object`);
  const path = nonEmptyString(value.path, `routes[${index}].path`);
  if (!MOUNT_PATH.test(path)) {
    throw new Error(
      `ROUTES: routes[${index}].path must look like "/" or "/traces", got ${JSON.stringify(path)}`,
    );
  }
  if (value.header !== undefined && typeof value.header !== "boolean") {
    throw new Error(`ROUTES: routes[${index}].header must be a boolean`);
  }
  return {
    path,
    binding: nonEmptyString(value.binding, `routes[${index}].binding`),
    header: value.header ?? false,
  };
}

/** Parses and validates `ROUTES`, given as JSON text or an already parsed value. */
export function parseRouterConfig(raw: unknown): RouterConfig {
  const value: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!isRecord(value) || !Array.isArray(value.routes) || value.routes.length === 0) {
    throw new Error("ROUTES: routes must be a non-empty array");
  }
  const routes = value.routes.map(parseRoute);
  if (new Set(routes.map((route) => route.path)).size !== routes.length) {
    throw new Error("ROUTES: mount paths must be unique");
  }

  let header: RouterConfig["header"];
  if (value.header !== undefined) {
    if (!isRecord(value.header)) throw new Error("ROUTES: header must be an object");
    const path = nonEmptyString(value.header.path, "header.path");
    if (!path.startsWith("/")) throw new Error("ROUTES: header.path must start with /");
    header = { binding: nonEmptyString(value.header.binding, "header.binding"), path };
  }
  if (routes.some((route) => route.header) && !header) {
    throw new Error("ROUTES sets `header` on a route but has no `header` fragment source");
  }
  return { routes, header };
}

/** The longest mount containing the path. `/traces` contains `/traces` and `/traces/x`, not `/tracesx`. */
export function matchRoute(routes: readonly Route[], pathname: string): Route | undefined {
  return [...routes]
    .sort((a, b) => b.path.length - a.path.length)
    .find(
      (route) =>
        route.path === "/" || pathname === route.path || pathname.startsWith(`${route.path}/`),
    );
}

/** The path the mounted app sees: the mount prefix removed, always starting with `/`. */
export function stripMount(mount: string, pathname: string): string {
  if (mount === "/") return pathname;
  return pathname.slice(mount.length) || "/";
}
