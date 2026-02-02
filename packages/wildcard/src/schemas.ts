import { z } from "zod";
import { isSafeURL, isValidSubdomain } from "./utils";

/** Validates that a URL is safe (http/https only, no private IPs) */
const safeUrl = () =>
  z.url().refine(isSafeURL, {
    message: "URL must use http/https and cannot target private/internal addresses",
  });

/** Validates subdomain format (alphanumeric with hyphens, 1-63 characters) */
export const subdomain = () =>
  z.string().refine(isValidSubdomain, {
    message: "Invalid subdomain format. Must be alphanumeric with hyphens, 1-63 characters.",
  });

// Zod schemas for validation
export const StaticConfigSchema = z
  .object({
    type: z.literal("static"),
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
export type RouteConfig = z.infer<typeof RouteConfigSchema>;
