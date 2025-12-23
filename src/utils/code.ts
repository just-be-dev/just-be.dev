const EPOCH = Date.UTC(2000, 0, 1); // January 1, 2000 UTC
const BASE16_CHARS = "0123456789ABCDEF" as const;

export const VALID_KINDS = ["B", "R", "P", "T"] as const;
export type Kind = (typeof VALID_KINDS)[number];

export const KIND_TO_COLLECTION = {
  B: "blog",
  R: "research",
  P: "projects",
  T: "talks",
} as const;
export type Collection = (typeof KIND_TO_COLLECTION)[Kind];

function isValidKind(char: string): char is Kind {
  return VALID_KINDS.includes(char as Kind);
}

export class Code {
  private readonly kind: Kind;
  private readonly dateCode: string;

  private constructor(kind: Kind, dateCode: string) {
    this.kind = kind;
    this.dateCode = dateCode.toUpperCase();
  }

  /**
   * Create a Code from a Date object
   * @param date - Date object to encode
   * @param kind - Kind identifier (B=blog, R=research, P=projects, T=talks)
   */
  static fromDate(date: Date, kind: Kind): Code {
    const days = Math.floor((date.getTime() - EPOCH) / (1000 * 60 * 60 * 24));
    let code = "";
    let remaining = days;

    for (let i = 0; i < 4; i++) {
      code = BASE16_CHARS[remaining % 16] + code;
      remaining = Math.floor(remaining / 16);
    }

    return new Code(kind, code);
  }

  /**
   * Create a Code from a UTC milliseconds timestamp
   * @param milliseconds - Milliseconds from epoch (e.g., result of Date.UTC())
   * @param kind - Kind identifier (B=blog, R=research, P=projects, T=talks)
   */
  static fromUTC(milliseconds: number, kind: Kind): Code {
    return Code.fromDate(new Date(milliseconds), kind);
  }

  /**
   * Create a Code from a date string
   * @param dateString - ISO date string (e.g., "2024-12-06", "2024-12-06T00:00:00Z")
   * @param kind - Kind identifier (B=blog, R=research, P=projects, T=talks)
   */
  static fromDateString(dateString: string, kind: Kind): Code {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date string");
    }
    return Code.fromDate(date, kind);
  }

  /**
   * Create a Code from a code string
   * @param code - 5-character code string (e.g., "B2391")
   */
  static fromCode(code: string): Code {
    // Validate string format
    if (code.length !== 5) {
      throw new Error("Code must be exactly 5 characters (1 kind + 4 date)");
    }

    const kindChar = code[0].toUpperCase();
    if (!isValidKind(kindChar)) {
      throw new Error(`Invalid kind '${kindChar}'. Must be one of: ${VALID_KINDS.join(", ")}`);
    }

    const dateCode = code.slice(1);
    if (!/^[0-9A-Fa-f]{4}$/.test(dateCode)) {
      throw new Error("Date code must contain only hex characters (0-9, A-F)");
    }

    return new Code(kindChar, dateCode);
  }

  /**
   * Create a Code from an astro page ID string
   * @param id - ID string (e.g., "B2391--this-is-a-page")
   */
  static fromId(id: string): Code {
    if (id.length < 5) {
      throw new Error(`ID too short to contain a code: ${id}`);
    }
    const code = id.slice(0, 5);
    return Code.fromCode(code);
  }

  /**
   * Parse an ID string into its code and slug components
   * @param id - ID string (e.g., "b24f9--the-values-i-build-by")
   * @returns Object with code (e.g., "b24f9") and slug (e.g., "the-values-i-build-by")
   */
  static parseId(id: string): { code: string; slug: string } {
    const separatorIndex = id.indexOf("--");
    if (separatorIndex === -1) {
      throw new Error(`ID does not contain '--' separator: ${id}`);
    }
    return {
      code: id.slice(0, separatorIndex),
      slug: id.slice(separatorIndex + 2),
    };
  }

  /**
   * Build a URL path for a content entry
   * @param collection - The collection name (e.g., "blog", "projects")
   * @param id - The entry ID (e.g., "b24f9--the-values-i-build-by")
   * @returns URL path (e.g., "/blog/b24f9/the-values-i-build-by/")
   */
  static buildUrl(collection: string, id: string): string {
    const { code, slug } = Code.parseId(id);
    return `/${collection}/${code}/${slug}/`;
  }

  /**
   * Convert the code to a Date object
   */
  toDate(): Date {
    const days = parseInt(this.dateCode, 16);
    return new Date(EPOCH + days * 24 * 60 * 60 * 1000);
  }

  /**
   * Get the string representation of the code (includes kind prefix)
   */
  toString(): string {
    return this.kind + this.dateCode;
  }

  /**
   * Get the kind identifier
   */
  getKind(): Kind {
    return this.kind;
  }

  /**
   * Get the date code portion (without kind prefix)
   */
  getDateCode(): string {
    return this.dateCode;
  }

  /**
   * Get the raw value (same as toString)
   */
  valueOf(): string {
    return this.toString();
  }

  /**
   * Get the collection name for this code's kind
   */
  getCollection(): Collection {
    return KIND_TO_COLLECTION[this.kind];
  }

  /**
   * Helper to generate getStaticPaths for Astro routes
   * @param collection - The collection to get entries from
   * @returns Array of path objects with code/slug params and entry props
   */
  static async getStaticPaths<T>(collection: Awaited<ReturnType<typeof import("astro:content").getCollection<any>>>) {
    return collection.map((entry) => {
      const { code, slug } = Code.parseId(entry.id);
      return {
        params: { code, slug },
        props: entry,
      };
    });
  }
}

// Usage examples:
// Create from a Date:
// const code = Code.fromDate(new Date(Date.UTC(2024, 11, 6)), "B");
// code.toString() // "B2392"

// Create from UTC milliseconds:
// const code = Code.fromUTC(Date.UTC(2024, 11, 6), "B");
// code.toString() // "B2392"

// Create from a date string:
// const code = Code.fromDateString("2024-12-06", "B");
// code.toString() // "B2392"

// Create from a code string:
// const code = Code.fromCode("B2392");
// code.toDate() // Date object for 2024-12-06
// code.getKind() // "B"

// Inline tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

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
      expect(() => Code.fromCode("B23")).toThrow("Code must be exactly 5 characters (1 kind + 4 date)");
    });

    it("should reject codes that are too long", () => {
      expect(() => Code.fromCode("B23456")).toThrow("Code must be exactly 5 characters (1 kind + 4 date)");
    });

    it("should reject codes with invalid kind", () => {
      expect(() => Code.fromCode("X2391")).toThrow("Invalid kind 'X'. Must be one of: B, R, P, T");
    });

    it("should reject codes with non-hex characters in date portion", () => {
      expect(() => Code.fromCode("B239G")).toThrow("Date code must contain only hex characters (0-9, A-F)");
    });

    it("should reject codes with invalid characters", () => {
      expect(() => Code.fromCode("B239!")).toThrow("Date code must contain only hex characters (0-9, A-F)");
    });

    it("should accept all valid kinds", () => {
      expect(Code.fromCode("B2391").getKind()).toBe("B");
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
          originalDate.toISOString().split("T")[0]
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
      expect(result.code).toBe("b24f9");
      expect(result.slug).toBe("the-values-i-build-by");
    });

    it("should handle IDs with multiple dashes in slug", () => {
      const result = Code.parseId("b2392--my-really-long-blog-post-title");
      expect(result.code).toBe("b2392");
      expect(result.slug).toBe("my-really-long-blog-post-title");
    });

    it("should reject IDs without separator", () => {
      expect(() => Code.parseId("b2392noseparator")).toThrow(
        "ID does not contain '--' separator"
      );
    });
  });

  describe("Code.buildUrl()", () => {
    it("should build URL path for blog", () => {
      const url = Code.buildUrl("blog", "b24f9--the-values-i-build-by");
      expect(url).toBe("/blog/b24f9/the-values-i-build-by/");
    });

    it("should build URL path for projects", () => {
      const url = Code.buildUrl("projects", "p1e73--devtools-fm");
      expect(url).toBe("/projects/p1e73/devtools-fm/");
    });

    it("should build URL path for research", () => {
      const url = Code.buildUrl("research", "r24e5--parsing-techniques");
      expect(url).toBe("/research/r24e5/parsing-techniques/");
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

    it("should return 'talks' for kind T", () => {
      expect(Code.fromCode("T2392").getCollection()).toBe("talks");
    });
  });
}
