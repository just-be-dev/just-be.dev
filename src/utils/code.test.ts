import { describe, it, expect } from "bun:test";
import { Code, VALID_KINDS } from "./code";

const EPOCH = Date.UTC(2000, 0, 1); // January 1, 2000 UTC

describe("Code.fromDate()", () => {
  it("should encode epoch date as B0000", () => {
    const epochDate = new Date(EPOCH);
    const code = Code.fromDate(epochDate, "B");
    expect(code.toString()).toBe("B0000");
  });

  it("should encode dates consistently with hex", () => {
    const date = new Date(Date.UTC(2024, 11, 6)); // December 6, 2024 UTC
    const code = Code.fromDate(date, "B");
    expect(code.toString()).toBe("B2392"); // 9106 days = 0x2392
  });

  it("should handle dates one day after epoch", () => {
    const date = new Date(EPOCH + 24 * 60 * 60 * 1000);
    const code = Code.fromDate(date, "B");
    expect(code.toString()).toBe("B0001");
  });

  it("should handle larger dates", () => {
    const date = new Date(Date.UTC(2025, 0, 1)); // January 1, 2025 UTC
    const code = Code.fromDate(date, "B");
    expect(code.toString()).toMatch(/^B[0-9A-F]{4}$/);
  });

  it("should support different kinds", () => {
    const date = new Date(Date.UTC(2024, 11, 6));
    expect(Code.fromDate(date, "B").toString()).toBe("B2392");
    expect(Code.fromDate(date, "G").toString()).toBe("G2392");
    expect(Code.fromDate(date, "R").toString()).toBe("R2392");
    expect(Code.fromDate(date, "P").toString()).toBe("P2392");
    expect(Code.fromDate(date, "T").toString()).toBe("T2392");
  });
});

describe("Code.fromUTC()", () => {
  it("should create from milliseconds timestamp", () => {
    const code = Code.fromUTC(Date.UTC(2024, 11, 6), "B");
    expect(code.toString()).toBe("B2392");
  });

  it("should create from epoch timestamp", () => {
    const code = Code.fromUTC(EPOCH, "B");
    expect(code.toString()).toBe("B0000");
  });
});

describe("Code.fromDateString()", () => {
  it("should create from ISO date string", () => {
    const code = Code.fromDateString("2024-12-06", "B");
    expect(code.toString()).toBe("B2392");
  });

  it("should create from ISO datetime string", () => {
    const code = Code.fromDateString("2024-12-06T00:00:00Z", "B");
    expect(code.toString()).toBe("B2392");
  });

  it("should reject invalid date strings", () => {
    expect(() => Code.fromDateString("invalid-date", "B")).toThrow("Invalid date string");
  });
});

describe("Code.fromCode()", () => {
  it("should parse valid code strings", () => {
    const code = Code.fromCode("B2391");
    expect(code.toString()).toBe("B2391");
  });

  it("should accept lowercase kind and normalize to uppercase", () => {
    const code = Code.fromCode("b2391");
    expect(code.toString()).toBe("B2391");
  });

  it("should reject codes that are too short", () => {
    expect(() => Code.fromCode("B23")).toThrow(
      "Code must be exactly 5 characters (1 kind + 4 date)",
    );
  });

  it("should reject codes that are too long", () => {
    expect(() => Code.fromCode("B23456")).toThrow(
      "Code must be exactly 5 characters (1 kind + 4 date)",
    );
  });

  it("should reject codes with invalid kind", () => {
    expect(() => Code.fromCode("X2391")).toThrow(
      `Invalid kind 'X'. Must be one of: ${VALID_KINDS.join(", ")}`,
    );
  });

  it("should reject codes with non-hex characters in date portion", () => {
    expect(() => Code.fromCode("B239G")).toThrow(
      "Date code must contain only hex characters (0-9, A-F)",
    );
  });

  it("should reject codes with invalid characters", () => {
    expect(() => Code.fromCode("B239!")).toThrow(
      "Date code must contain only hex characters (0-9, A-F)",
    );
  });

  it("should accept all valid kinds", () => {
    expect(Code.fromCode("B2391").getKind()).toBe("B");
    expect(Code.fromCode("G2391").getKind()).toBe("G");
    expect(Code.fromCode("R2391").getKind()).toBe("R");
    expect(Code.fromCode("P2391").getKind()).toBe("P");
    expect(Code.fromCode("T2391").getKind()).toBe("T");
  });
});

describe("Code.toDate()", () => {
  it("should decode B0000 as epoch date", () => {
    const code = Code.fromCode("B0000");
    const date = code.toDate();
    expect(date.getTime()).toBe(EPOCH);
  });

  it("should decode dates consistently", () => {
    const code = Code.fromCode("B2392");
    const date = code.toDate();
    expect(date.getTime()).toBe(Date.UTC(2024, 11, 6));
  });

  it("should decode B0001 as one day after epoch", () => {
    const code = Code.fromCode("B0001");
    const date = code.toDate();
    expect(date.getTime()).toBe(EPOCH + 24 * 60 * 60 * 1000);
  });
});

describe("roundtrip", () => {
  it("should roundtrip correctly for various dates", () => {
    const testDates = [
      new Date(Date.UTC(2000, 0, 1)),
      new Date(Date.UTC(2024, 11, 6)),
      new Date(Date.UTC(2025, 0, 1)),
      new Date(Date.UTC(2030, 5, 15)),
    ];

    for (const originalDate of testDates) {
      const code = Code.fromDate(originalDate, "B");
      const decodedDate = code.toDate();
      // Compare by day (ignoring time components)
      expect(decodedDate.toISOString().split("T")[0]).toBe(
        originalDate.toISOString().split("T")[0],
      );
    }
  });
});

describe("Code.fromId()", () => {
  it("should extract code from ID string", () => {
    const code = Code.fromId("B2392--my-blog-post");
    expect(code.toString()).toBe("B2392");
    expect(code.getKind()).toBe("B");
  });

  it("should handle lowercase codes in IDs", () => {
    const code = Code.fromId("b2392--my-blog-post");
    expect(code.toString()).toBe("B2392");
  });

  it("should reject IDs that are too short", () => {
    expect(() => Code.fromId("B23")).toThrow("ID too short to contain a code");
  });
});

describe("getters", () => {
  it("should return kind via getKind()", () => {
    expect(Code.fromCode("B2392").getKind()).toBe("B");
    expect(Code.fromCode("G2392").getKind()).toBe("G");
    expect(Code.fromCode("R2392").getKind()).toBe("R");
    expect(Code.fromCode("P2392").getKind()).toBe("P");
    expect(Code.fromCode("T2392").getKind()).toBe("T");
  });

  it("should return date code via getDateCode()", () => {
    expect(Code.fromCode("B2392").getDateCode()).toBe("2392");
  });
});

describe("Code.parseId()", () => {
  it("should parse ID into code and slug", () => {
    const result = Code.parseId("b24f9--the-values-i-build-by");
    expect(result.code).toBe("B24F9");
    expect(result.slug).toBe("the-values-i-build-by");
  });

  it("should handle IDs with multiple dashes in slug", () => {
    const result = Code.parseId("b2392--my-really-long-blog-post-title");
    expect(result.code).toBe("B2392");
    expect(result.slug).toBe("my-really-long-blog-post-title");
  });

  it("should reject IDs without separator", () => {
    expect(() => Code.parseId("b2392noseparator")).toThrow("ID does not contain '--' separator");
  });
});

describe("Code.buildUrl()", () => {
  it("should build URL path for blog", () => {
    const url = Code.buildUrl("blog", "the-values-i-build-by");
    expect(url).toBe("/blog/the-values-i-build-by");
  });

  it("should build URL path for projects", () => {
    const url = Code.buildUrl("projects", "devtools-fm");
    expect(url).toBe("/projects/devtools-fm");
  });

  it("should build URL path for research", () => {
    const url = Code.buildUrl("research", "parsing-techniques");
    expect(url).toBe("/research/parsing-techniques");
  });
});

describe("Code.getCollection()", () => {
  it("should return 'blog' for kind B", () => {
    expect(Code.fromCode("B2392").getCollection()).toBe("blog");
  });

  it("should return 'research' for kind R", () => {
    expect(Code.fromCode("R2392").getCollection()).toBe("research");
  });

  it("should return 'projects' for kind P", () => {
    expect(Code.fromCode("P2392").getCollection()).toBe("projects");
  });

  it("should return 'games' for kind G", () => {
    expect(Code.fromCode("G2392").getCollection()).toBe("games");
  });

  it("should return 'talks' for kind T", () => {
    expect(Code.fromCode("T2392").getCollection()).toBe("talks");
  });
});
