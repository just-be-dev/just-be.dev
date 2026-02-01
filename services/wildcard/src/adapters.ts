/**
 * Cloudflare-specific adapters for R2 and KV
 */

import type { FileLoader, RouteConfigLoader, FileObject } from "@just-be/wildcard";

/**
 * Cloudflare environment bindings
 */
export interface Env {
  ROUTING_RULES: KVNamespace;
  CONTENT_BUCKET: R2Bucket;
  ORIGIN_URL: string;
}

/**
 * Creates a FileLoader that uses Cloudflare R2
 */
export function createR2FileLoader(bucket: R2Bucket): FileLoader {
  return {
    async loadFile(path: string): Promise<FileObject | null> {
      const object = await bucket.get(path);

      if (!object) {
        return null;
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);

      return {
        body: object.body,
        headers,
        etag: object.httpEtag,
        size: object.size,
      };
    },
  };
}

/**
 * Creates a RouteConfigLoader that uses Cloudflare KV
 */
export function createKVRouteConfigLoader(kv: KVNamespace): RouteConfigLoader {
  return {
    async loadRouteConfig(subdomain: string): Promise<string | null> {
      return await kv.get(subdomain);
    },
  };
}
