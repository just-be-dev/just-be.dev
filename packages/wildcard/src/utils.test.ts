import { describe, it, expect } from "bun:test";
import {
  getContentType,
  isSafeURL,
  sanitizePath,
  filterSafeHeaders,
  isValidSubdomain,
  SAFE_REQUEST_HEADERS,
} from "./utils";

describe("getContentType", () => {
  it("should return correct MIME types for common file extensions", () => {
    expect(getContentType("index.html")).toBe("text/html");
    expect(getContentType("style.css")).toBe("text/css");
    expect(getContentType("script.js")).toBe("application/javascript");
    expect(getContentType("data.json")).toBe("application/json");
    expect(getContentType("image.png")).toBe("image/png");
    expect(getContentType("photo.jpg")).toBe("image/jpeg");
    expect(getContentType("photo.jpeg")).toBe("image/jpeg");
    expect(getContentType("icon.svg")).toBe("image/svg+xml");
    expect(getContentType("font.woff2")).toBe("font/woff2");
  });

  it("should handle uppercase extensions", () => {
    expect(getContentType("FILE.HTML")).toBe("text/html");
    expect(getContentType("IMAGE.PNG")).toBe("image/png");
  });

  it("should handle paths with multiple dots", () => {
    expect(getContentType("file.min.js")).toBe("application/javascript");
    expect(getContentType("archive.tar.gz")).toBe(null);
  });

  it("should return null for unknown extensions", () => {
    expect(getContentType("file.xyz")).toBe(null);
    expect(getContentType("README")).toBe(null);
  });

  it("should return null for files without extensions", () => {
    expect(getContentType("Dockerfile")).toBe(null);
    expect(getContentType("Makefile")).toBe(null);
  });
});

describe("isSafeURL", () => {
  describe("valid URLs", () => {
    it("should allow valid http and https URLs", () => {
      expect(isSafeURL("https://example.com")).toBe(true);
      expect(isSafeURL("http://example.com")).toBe(true);
      expect(isSafeURL("https://api.example.com/path?query=value")).toBe(true);
      expect(isSafeURL("https://sub.domain.example.com")).toBe(true);
    });
  });

  describe("protocol validation", () => {
    it("should reject non-http/https protocols", () => {
      expect(isSafeURL("file:///etc/passwd")).toBe(false);
      expect(isSafeURL("ftp://example.com")).toBe(false);
      expect(isSafeURL("javascript:alert(1)")).toBe(false);
      expect(isSafeURL("data:text/html,<script>alert(1)</script>")).toBe(false);
      expect(isSafeURL("gopher://example.com")).toBe(false);
    });
  });

  describe("SSRF protection - localhost", () => {
    it("should block localhost", () => {
      expect(isSafeURL("http://localhost")).toBe(false);
      expect(isSafeURL("http://localhost:8080")).toBe(false);
      expect(isSafeURL("http://LOCALHOST")).toBe(false);
      expect(isSafeURL("http://localhost.localdomain")).toBe(false);
    });

    it("should block 127.x.x.x (loopback)", () => {
      expect(isSafeURL("http://127.0.0.1")).toBe(false);
      expect(isSafeURL("http://127.0.0.1:8080")).toBe(false);
      expect(isSafeURL("http://127.1.1.1")).toBe(false);
      expect(isSafeURL("http://127.255.255.255")).toBe(false);
    });

    it("should block IPv6 localhost", () => {
      expect(isSafeURL("http://[::1]")).toBe(false);
      expect(isSafeURL("http://[::1]:8080")).toBe(false);
    });
  });

  describe("SSRF protection - private IP ranges", () => {
    it("should block 10.x.x.x (private class A)", () => {
      expect(isSafeURL("http://10.0.0.1")).toBe(false);
      expect(isSafeURL("http://10.1.2.3")).toBe(false);
      expect(isSafeURL("http://10.255.255.255")).toBe(false);
    });

    it("should block 192.168.x.x (private class C)", () => {
      expect(isSafeURL("http://192.168.0.1")).toBe(false);
      expect(isSafeURL("http://192.168.1.1")).toBe(false);
      expect(isSafeURL("http://192.168.255.255")).toBe(false);
    });

    it("should block 172.16-31.x.x (private class B)", () => {
      expect(isSafeURL("http://172.16.0.1")).toBe(false);
      expect(isSafeURL("http://172.20.10.5")).toBe(false);
      expect(isSafeURL("http://172.31.255.255")).toBe(false);
    });

    it("should allow non-private 172.x.x.x addresses", () => {
      expect(isSafeURL("http://172.15.0.1")).toBe(true);
      expect(isSafeURL("http://172.32.0.1")).toBe(true);
    });
  });

  describe("SSRF protection - cloud metadata endpoints", () => {
    it("should block 169.254.x.x (link-local/metadata)", () => {
      expect(isSafeURL("http://169.254.169.254")).toBe(false);
      expect(isSafeURL("http://169.254.169.254/latest/meta-data")).toBe(false);
      expect(isSafeURL("http://169.254.1.1")).toBe(false);
    });
  });

  describe("SSRF protection - other restricted ranges", () => {
    it("should block 0.0.0.0/8", () => {
      expect(isSafeURL("http://0.0.0.0")).toBe(false);
      expect(isSafeURL("http://0.1.2.3")).toBe(false);
    });

    it("should block IPv6 link-local (fe80::)", () => {
      expect(isSafeURL("http://[fe80::1]")).toBe(false);
      expect(isSafeURL("http://[fe80:0000:0000:0000:0000:0000:0000:0001]")).toBe(false);
    });

    it("should block IPv6 unique local (fc00::/7)", () => {
      expect(isSafeURL("http://[fc00::1]")).toBe(false);
      expect(isSafeURL("http://[fd00::1]")).toBe(false);
    });
  });

  describe("invalid URLs", () => {
    it("should return false for malformed URLs", () => {
      expect(isSafeURL("not a url")).toBe(false);
      expect(isSafeURL("")).toBe(false);
      expect(isSafeURL("htp://example.com")).toBe(false);
    });
  });
});

describe("sanitizePath", () => {
  describe("valid paths", () => {
    it("should allow and sanitize simple paths", () => {
      expect(sanitizePath("file.txt")).toBe("file.txt");
      expect(sanitizePath("dir/file.txt")).toBe("dir/file.txt");
      expect(sanitizePath("a/b/c/file.txt")).toBe("a/b/c/file.txt");
    });

    it("should remove leading slashes", () => {
      expect(sanitizePath("/file.txt")).toBe("file.txt");
      expect(sanitizePath("//file.txt")).toBe("file.txt");
      expect(sanitizePath("///path/to/file.txt")).toBe("path/to/file.txt");
    });
  });

  describe("directory traversal protection", () => {
    it("should reject paths with ..", () => {
      expect(sanitizePath("../file.txt")).toBe(null);
      expect(sanitizePath("dir/../file.txt")).toBe(null);
      expect(sanitizePath("../../etc/passwd")).toBe(null);
      expect(sanitizePath("dir/../../file.txt")).toBe(null);
    });

    it("should reject paths with .", () => {
      expect(sanitizePath("./file.txt")).toBe(null);
      expect(sanitizePath("dir/./file.txt")).toBe(null);
      expect(sanitizePath(".")).toBe(null);
    });

    it("should reject paths with double slashes (empty segments)", () => {
      expect(sanitizePath("dir//file.txt")).toBe(null);
      expect(sanitizePath("a/b//c")).toBe(null);
    });
  });

  describe("null byte protection", () => {
    it("should reject paths with null bytes", () => {
      expect(sanitizePath("file\0.txt")).toBe(null);
      expect(sanitizePath("dir/file\x00.txt")).toBe(null);
    });
  });

  describe("edge cases", () => {
    it("should handle paths with hyphens and underscores", () => {
      expect(sanitizePath("my-file_name.txt")).toBe("my-file_name.txt");
      expect(sanitizePath("some-dir/my_file.txt")).toBe("some-dir/my_file.txt");
    });

    it("should handle paths with spaces", () => {
      expect(sanitizePath("my file.txt")).toBe("my file.txt");
      expect(sanitizePath("some dir/my file.txt")).toBe("some dir/my file.txt");
    });
  });
});

describe("filterSafeHeaders", () => {
  it("should filter and keep only safe headers", () => {
    const headers = new Headers({
      accept: "application/json",
      "user-agent": "Mozilla/5.0",
      authorization: "Bearer secret-token",
      cookie: "session=abc123",
      "x-forwarded-for": "1.2.3.4",
    });

    const filtered = filterSafeHeaders(headers);

    expect(filtered.get("accept")).toBe("application/json");
    expect(filtered.get("user-agent")).toBe("Mozilla/5.0");
    expect(filtered.get("authorization")).toBe(null);
    expect(filtered.get("cookie")).toBe(null);
    expect(filtered.get("x-forwarded-for")).toBe(null);
  });

  it("should include all safe headers that are present", () => {
    const headers = new Headers({
      accept: "text/html",
      "accept-language": "en-US",
      "accept-encoding": "gzip",
      "cache-control": "no-cache",
      "content-type": "application/json",
      "user-agent": "Test",
      referer: "https://example.com",
      origin: "https://example.com",
    });

    const filtered = filterSafeHeaders(headers);

    for (const header of SAFE_REQUEST_HEADERS) {
      expect(filtered.has(header)).toBe(true);
    }
  });

  it("should return empty headers when no safe headers present", () => {
    const headers = new Headers({
      authorization: "Bearer token",
      cookie: "session=abc",
      "x-custom-header": "value",
    });

    const filtered = filterSafeHeaders(headers);

    expect([...filtered.keys()].length).toBe(0);
  });

  it("should be case-insensitive for header names", () => {
    const headers = new Headers({
      Accept: "application/json",
      "USER-AGENT": "Test",
      "Content-Type": "text/plain",
    });

    const filtered = filterSafeHeaders(headers);

    expect(filtered.get("accept")).toBe("application/json");
    expect(filtered.get("user-agent")).toBe("Test");
    expect(filtered.get("content-type")).toBe("text/plain");
  });
});

describe("isValidSubdomain", () => {
  describe("valid subdomains", () => {
    it("should allow single alphanumeric character", () => {
      expect(isValidSubdomain("a")).toBe(true);
      expect(isValidSubdomain("z")).toBe(true);
      expect(isValidSubdomain("0")).toBe(true);
      expect(isValidSubdomain("9")).toBe(true);
    });

    it("should allow alphanumeric subdomains", () => {
      expect(isValidSubdomain("test")).toBe(true);
      expect(isValidSubdomain("api")).toBe(true);
      expect(isValidSubdomain("www")).toBe(true);
      expect(isValidSubdomain("app123")).toBe(true);
      expect(isValidSubdomain("123app")).toBe(true);
    });

    it("should allow hyphens in the middle", () => {
      expect(isValidSubdomain("my-app")).toBe(true);
      expect(isValidSubdomain("test-api-v2")).toBe(true);
      expect(isValidSubdomain("a-b-c")).toBe(true);
    });

    it("should allow mixed case (validation is case-insensitive)", () => {
      expect(isValidSubdomain("MyApp")).toBe(true);
      expect(isValidSubdomain("TEST")).toBe(true);
    });

    it("should allow up to 63 characters", () => {
      const maxLength = "a".repeat(63);
      expect(isValidSubdomain(maxLength)).toBe(true);
    });
  });

  describe("invalid subdomains", () => {
    it("should reject empty string", () => {
      expect(isValidSubdomain("")).toBe(false);
    });

    it("should reject subdomains longer than 63 characters", () => {
      const tooLong = "a".repeat(64);
      expect(isValidSubdomain(tooLong)).toBe(false);
    });

    it("should reject subdomains starting with hyphen", () => {
      expect(isValidSubdomain("-test")).toBe(false);
      expect(isValidSubdomain("-")).toBe(false);
    });

    it("should reject subdomains ending with hyphen", () => {
      expect(isValidSubdomain("test-")).toBe(false);
      expect(isValidSubdomain("a-")).toBe(false);
    });

    it("should reject subdomains with consecutive hyphens", () => {
      expect(isValidSubdomain("test--app")).toBe(false);
      expect(isValidSubdomain("a--b")).toBe(false);
      expect(isValidSubdomain("---")).toBe(false);
    });

    it("should reject subdomains with special characters", () => {
      expect(isValidSubdomain("test_app")).toBe(false);
      expect(isValidSubdomain("test.app")).toBe(false);
      expect(isValidSubdomain("test@app")).toBe(false);
      expect(isValidSubdomain("test/app")).toBe(false);
      expect(isValidSubdomain("test app")).toBe(false);
    });

    it("should reject single character hyphens", () => {
      expect(isValidSubdomain("-")).toBe(false);
    });

    it("should reject single character special chars", () => {
      expect(isValidSubdomain("_")).toBe(false);
      expect(isValidSubdomain(".")).toBe(false);
      expect(isValidSubdomain("@")).toBe(false);
    });
  });
});
