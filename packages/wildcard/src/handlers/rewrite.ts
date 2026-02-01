import type { Handler } from "../types";
import type { RewriteConfig } from "../schemas";
import { filterSafeHeaders } from "../utils";

const FETCH_TIMEOUT_MS = 5_000;

export const handleRewrite: Handler<RewriteConfig> = async (request, config) => {
  const originalUrl = new URL(request.url);
  const { url: targetUrl, allowedMethods } = config;

  if (!(allowedMethods as string[]).includes(request.method)) {
    return new Response("Method not allowed", {
      status: 405,
      headers: {
        Allow: allowedMethods.join(", "),
      },
    });
  }

  // Construct the target URL with the original path and query
  const url = new URL(targetUrl);
  url.pathname = originalUrl.pathname;
  url.search = originalUrl.search;

  // Filter headers to only include safe ones (prevents header injection)
  const safeHeaders = filterSafeHeaders(request.headers);

  // Create a new request with the target URL and filtered headers
  const modifiedRequest = new Request(url.toString(), {
    method: request.method,
    headers: safeHeaders,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
  });

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(modifiedRequest, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Create a new response with the same body but potentially modified headers
    const newResponse = new Response(response.body, response);

    // Remove content-encoding header because the response body is already decoded
    // by the fetch API, and if we forward this header, the browser will try to
    // decode it again, causing corruption
    newResponse.headers.delete("content-encoding");

    return newResponse;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      return new Response("Request timeout", { status: 504 });
    }

    return new Response("Bad gateway", { status: 502 });
  }
};
