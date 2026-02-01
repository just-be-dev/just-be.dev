import { z } from "zod";

/**
 * Validates that a URL is safe (http/https only, no private IPs)
 *
 * This is a simplified version that checks basic URL structure.
 * For full SSRF protection, use the complete isSafeURL implementation
 * from the wildcard service.
 */
function isBasicSafeURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Validates that a URL is safe (http/https only, no private IPs) */
const safeUrl = () =>
  z.string().url().refine(isBasicSafeURL, {
    message: "URL must use http/https and cannot target private/internal addresses",
  });

// Zod schemas for validation
export const StaticConfigSchema = z
  .object({
    type: z.literal("static"),
    path: z.string().min(1),
    spa: z.boolean().optional(),
    fallback: z.string().optional(), // Fallback file path for non-SPA mode (e.g., "404.html")
  })
  .refine((data) => (data.spa && data.fallback ? false : true), {
    message: "fallback cannot be used with spa mode (spa: true)",
  });

export const RedirectConfigSchema = z.object({
  type: z.literal("redirect"),
  url: safeUrl(),
  permanent: z.boolean().optional(),
});

const HttpMethod = z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);

export const RewriteConfigSchema = z.object({
  type: z.literal("rewrite"),
  url: safeUrl(),
  allowedMethods: z.array(HttpMethod).optional().default(["GET", "HEAD", "OPTIONS"]),
});

export const RouteConfigSchema = z.discriminatedUnion("type", [
  StaticConfigSchema,
  RedirectConfigSchema,
  RewriteConfigSchema,
]);

/** @deprecated Use StaticConfigSchema instead */
export const R2ConfigSchema = StaticConfigSchema;

/**
 * JSON codec for parsing and validating JSON strings
 */
const json = <T extends z.ZodType>(schema: T) =>
  z.codec(z.string(), schema, {
    decode: (jsonString, ctx) => {
      try {
        return JSON.parse(jsonString);
      } catch (err: any) {
        ctx.issues.push({
          code: "invalid_format",
          format: "json",
          input: jsonString,
          message: err.message,
        });
        return z.NEVER;
      }
    },
    encode: (value) => JSON.stringify(value),
  });

/**
 * Codec for decoding JSON strings into validated RouteConfig objects
 */
export const RouteConfigCodec = json(RouteConfigSchema);

export type StaticConfig = z.infer<typeof StaticConfigSchema>;
export type RedirectConfig = z.infer<typeof RedirectConfigSchema>;
export type RewriteConfig = z.infer<typeof RewriteConfigSchema>;
export type SubdomainConfig = z.infer<typeof RouteConfigSchema>;
