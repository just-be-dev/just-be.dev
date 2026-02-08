import { describe, it, expect } from "bun:test";
import { handleRedirect } from "./redirect";
import type { RedirectConfig } from "../schemas";

function makeRequest(url: string): Request {
  return new Request(url);
}

describe("handleRedirect", () => {
  it("should redirect with 302 by default", async () => {
    const config: RedirectConfig = { type: "redirect", url: "https://example.com" };
    const response = await handleRedirect(makeRequest("https://sub.just-be.dev/"), config);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.com");
  });

  it("should redirect with 301 when permanent is true", async () => {
    const config: RedirectConfig = {
      type: "redirect",
      url: "https://example.com",
      permanent: true,
    };
    const response = await handleRedirect(makeRequest("https://sub.just-be.dev/"), config);
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://example.com");
  });

  it("should redirect with 302 when permanent is false", async () => {
    const config: RedirectConfig = {
      type: "redirect",
      url: "https://example.com",
      permanent: false,
    };
    const response = await handleRedirect(makeRequest("https://sub.just-be.dev/"), config);
    expect(response.status).toBe(302);
  });

  describe("preservePath", () => {
    it("should append path to target URL", async () => {
      const config: RedirectConfig = {
        type: "redirect",
        url: "https://github.com/just-be-dev",
        permanent: true,
        preservePath: true,
      };
      const response = await handleRedirect(makeRequest("https://git.just-be.dev/pds"), config);
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe("https://github.com/just-be-dev/pds");
    });

    it("should preserve query string", async () => {
      const config: RedirectConfig = {
        type: "redirect",
        url: "https://github.com/just-be-dev",
        preservePath: true,
      };
      const response = await handleRedirect(
        makeRequest("https://git.just-be.dev/pds?tab=readme"),
        config,
      );
      expect(response.headers.get("location")).toBe(
        "https://github.com/just-be-dev/pds?tab=readme",
      );
    });

    it("should handle root path request", async () => {
      const config: RedirectConfig = {
        type: "redirect",
        url: "https://github.com/just-be-dev",
        preservePath: true,
      };
      const response = await handleRedirect(makeRequest("https://git.just-be.dev/"), config);
      expect(response.headers.get("location")).toBe("https://github.com/just-be-dev/");
    });

    it("should handle target URL with trailing slash", async () => {
      const config: RedirectConfig = {
        type: "redirect",
        url: "https://github.com/just-be-dev/",
        preservePath: true,
      };
      const response = await handleRedirect(makeRequest("https://git.just-be.dev/pds"), config);
      expect(response.headers.get("location")).toBe("https://github.com/just-be-dev/pds");
    });

    it("should not preserve path when preservePath is not set", async () => {
      const config: RedirectConfig = {
        type: "redirect",
        url: "https://example.com",
      };
      const response = await handleRedirect(
        makeRequest("https://sub.just-be.dev/some/path"),
        config,
      );
      expect(response.headers.get("location")).toBe("https://example.com");
    });
  });
});
