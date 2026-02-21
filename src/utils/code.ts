const EPOCH = Date.UTC(2000, 0, 1); // January 1, 2000 UTC
const BASE16_CHARS = "0123456789ABCDEF" as const;

export const VALID_KINDS = ["B", "G", "R", "P", "T", "M"] as const;
export type Kind = (typeof VALID_KINDS)[number];

export const KIND_TO_COLLECTION = {
  B: "blog",
  G: "games",
  R: "research",
  P: "projects",
  T: "talks",
  M: "micro",
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
   * @returns Object with code (e.g., "B24F9") and slug (e.g., "the-values-i-build-by")
   */
  static parseId(id: string): { code: string; slug: string } {
    const separatorIndex = id.indexOf("--");
    if (separatorIndex === -1) {
      throw new Error(`ID does not contain '--' separator: ${id}`);
    }
    return {
      code: id.slice(0, separatorIndex).toUpperCase(),
      slug: id.slice(separatorIndex + 2),
    };
  }

  /**
   * Build a URL path for a content entry
   * @param collection - The collection name (e.g., "blog", "projects")
   * @param slug - The slug (e.g., "the-values-i-build-by")
   * @returns URL path (e.g., "/blog/the-values-i-build-by")
   */
  static buildUrl(collection: string, slug: string): string {
    return `/${collection}/${slug}`;
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
  static async getStaticPaths(
    collection: Awaited<ReturnType<typeof import("astro:content").getCollection<any>>>,
  ) {
    return collection.map((entry) => {
      // Use code from frontmatter (entry.data.code)
      const code = entry.data.code;
      const slug = entry.id.replace(/\.mdx?$/, ""); // Remove file extension if present
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
