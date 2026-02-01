import type { StaticConfig, RedirectConfig, RewriteConfig } from "./schemas";

/**
 * Represents a file object from any storage backend
 */
export interface FileObject {
  /** File body as a ReadableStream or ArrayBuffer */
  body: ReadableStream<Uint8Array> | ArrayBuffer | null;
  /** HTTP headers associated with the file */
  headers?: Headers;
  /** ETag for cache validation */
  etag?: string;
  /** Size of the file in bytes */
  size?: number;
}

/**
 * Interface for loading files from a storage backend
 */
export interface FileLoader {
  /**
   * Load a file from storage by its path
   * @param path - The path to the file
   * @returns The file object, or null if not found
   */
  loadFile(path: string): Promise<FileObject | null>;
}

/**
 * Interface for loading route configurations
 */
export interface RouteConfigLoader {
  /**
   * Load route configuration for a subdomain
   * @param subdomain - The subdomain name
   * @returns The configuration as a JSON string, or null if not found
   */
  loadRouteConfig(subdomain: string): Promise<string | null>;
}

/**
 * Handler function type with dependency injection
 * @template T - The config type (StaticConfig, RedirectConfig, or RewriteConfig)
 * @template D - Optional dependency object (e.g., { fileLoader: FileLoader })
 */
export type Handler<
  T extends StaticConfig | RedirectConfig | RewriteConfig,
  D extends Record<string, unknown> = never,
> = [D] extends [never]
  ? (request: Request, config: T) => Promise<Response>
  : (request: Request, config: T, dependency: D) => Promise<Response>;
