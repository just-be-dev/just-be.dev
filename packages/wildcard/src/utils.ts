/**
 * Content type detection and security utilities
 */

export function getContentType(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    xml: "application/xml",
    txt: "text/plain",
  };
  return types[ext || ""] || null;
}

/**
 * Security utilities for validating URLs and preventing SSRF attacks
 */

/**
 * Checks if an IP address is in a private range
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  const privateRanges = [
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^127\./, // 127.0.0.0/8 (localhost)
    /^169\.254\./, // 169.254.0.0/16 (link-local, includes cloud metadata)
    /^0\./, // 0.0.0.0/8
    /^::1$/, // IPv6 localhost
    /^fe80:/i, // IPv6 link-local
    /^fc00:/i, // IPv6 unique local
    /^fd00:/i, // IPv6 unique local
  ];

  return privateRanges.some((range) => range.test(ip));
}

/**
 * Checks if a hostname resolves to localhost or private IPs
 */
function isSuspiciousHostname(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase();

  // Block localhost variants
  if (lowerHostname === "localhost" || lowerHostname === "localhost.localdomain") {
    return true;
  }

  // Block if hostname is an IP address and it's private
  // IPv4 check
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return isPrivateIP(hostname);
  }

  // IPv6 check - URL parser keeps square brackets in hostname
  // Remove brackets for validation
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    const ipv6 = hostname.slice(1, -1);
    return isPrivateIP(ipv6);
  }

  return false;
}

/**
 * Validates a URL to prevent SSRF attacks
 * @param url - The URL to validate
 * @returns true if URL is safe, false otherwise
 */
export function isSafeURL(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    if (isSuspiciousHostname(parsed.hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes a file path to prevent directory traversal attacks
 * @param path - The path to sanitize
 * @returns Sanitized path or null if path is invalid
 */
export function sanitizePath(path: string): string | null {
  // Remove leading slashes
  let normalized = path.replace(/^\/+/, "");

  // Split into segments
  const segments = normalized.split("/");

  // Check each segment
  for (const segment of segments) {
    // Reject if segment is .. or . or empty (double slashes)
    if (segment === ".." || segment === "." || segment === "") {
      return null;
    }

    // Reject if segment contains null bytes or other suspicious characters
    if (segment.includes("\0") || segment.includes("\x00")) {
      return null;
    }
  }

  // Rebuild the path from clean segments
  return segments.join("/");
}

/**
 * List of safe headers that can be forwarded in proxy requests
 */
export const SAFE_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "accept-encoding",
  "cache-control",
  "content-type",
  "user-agent",
  "referer",
  "origin",
] as const;

/**
 * Filters request headers to only include safe headers
 *
 * @param headers - Original headers
 */
export function filterSafeHeaders(headers: Headers): Headers {
  const filtered = new Headers();

  for (const header of SAFE_REQUEST_HEADERS) {
    const value = headers.get(header);
    if (value) {
      filtered.set(header, value);
    }
  }

  return filtered;
}

/**
 * Validates subdomain name format and length
 * @param subdomain - The subdomain to validate
 * @returns true if subdomain is valid
 */
export function isValidSubdomain(subdomain: string): boolean {
  // DNS label max length is 63 characters
  if (subdomain.length === 0 || subdomain.length > 63) {
    return false;
  }

  // Must start and end with alphanumeric
  if (!/^[a-z0-9].*[a-z0-9]$/i.test(subdomain) && subdomain.length > 1) {
    return false;
  }

  // Single character must be alphanumeric
  if (subdomain.length === 1 && !/^[a-z0-9]$/i.test(subdomain)) {
    return false;
  }

  // Can only contain alphanumeric and hyphens
  if (!/^[a-z0-9-]+$/i.test(subdomain)) {
    return false;
  }

  // Cannot have consecutive hyphens
  if (subdomain.includes("--")) {
    return false;
  }

  return true;
}
