// Minimal ambient types for the Workers runtime module. The full
// @cloudflare/workers-types package isn't a dependency of the site; bindings are
// typed where they're read (see src/utils/site-projects.ts).
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
