const EPOCH = Date.UTC(2000, 0, 1); // January 1, 2000 UTC
const BASE36_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" as const;

export class Code {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value.toUpperCase();
  }

  /**
   * Create a Code from a Date object
   * @param date - Date object to encode
   */
  static fromDate(date: Date): Code {
    const days = Math.floor((date.getTime() - EPOCH) / (1000 * 60 * 60 * 24));
    let code = "";
    let remaining = days;

    for (let i = 0; i < 4; i++) {
      code = BASE36_CHARS[remaining % 36] + code;
      remaining = Math.floor(remaining / 36);
    }

    return new Code(code);
  }

  /**
   * Create a Code from a UTC milliseconds timestamp
   * @param milliseconds - Milliseconds from epoch (e.g., result of Date.UTC())
   */
  static fromUTC(milliseconds: number): Code {
    return Code.fromDate(new Date(milliseconds));
  }

  /**
   * Create a Code from a date string
   * @param dateString - ISO date string (e.g., "2024-12-06", "2024-12-06T00:00:00Z")
   */
  static fromDateString(dateString: string): Code {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date string");
    }
    return Code.fromDate(date);
  }

  /**
   * Create a Code from a code string
   * @param code - 4-character code string (e.g., "070Y")
   */
  static fromCode(code: string): Code {
    // Validate string format
    if (code.length !== 4) {
      throw new Error("Code must be exactly 4 characters");
    }
    if (!/^[0-9A-Za-z]{4}$/.test(code)) {
      throw new Error("Code must contain only letters and numbers");
    }
    return new Code(code);
  }

  /**
   * Create a Code from an astro page ID string
   * @param id - ID string (e.g., "070Y--this-is-a-page")
   */
  static fromId(id: string): Code {
    const code = id.slice(0, 4);
    return Code.fromCode(code);
  }

  /**
   * Convert the code to a Date object
   */
  toDate(): Date {
    const days = parseInt(this.value, 36);
    return new Date(EPOCH + days * 24 * 60 * 60 * 1000);
  }

  /**
   * Get the string representation of the code
   */
  toString(): string {
    return this.value;
  }

  /**
   * Get the raw value (same as toString)
   */
  valueOf(): string {
    return this.toString();
  }
}

// Usage examples:
// Create from a Date:
// const code = Code.fromDate(new Date(Date.UTC(2024, 11, 6)));
// code.toString() // "070Y"

// Create from UTC milliseconds:
// const code = Code.fromUTC(Date.UTC(2024, 11, 6));
// code.toString() // "070Y"

// Create from a date string:
// const code = Code.fromDateString("2024-12-06");
// code.toString() // "070Y"

// Create from a code string:
// const code = Code.fromCode("070Y");
// code.toDate() // Date object for 2024-12-06

// Inline tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe("Code.fromDate()", () => {
    it("should encode epoch date as 0000", () => {
      const epochDate = new Date(EPOCH);
      const code = Code.fromDate(epochDate);
      expect(code.toString()).toBe("0000");
    });

    it("should encode dates consistently", () => {
      const date = new Date(Date.UTC(2024, 11, 6)); // December 6, 2024 UTC
      const code = Code.fromDate(date);
      expect(code.toString()).toBe("070Y");
    });

    it("should handle dates one day after epoch", () => {
      const date = new Date(EPOCH + 24 * 60 * 60 * 1000);
      const code = Code.fromDate(date);
      expect(code.toString()).toBe("0001");
    });

    it("should handle larger dates", () => {
      const date = new Date(Date.UTC(2025, 0, 1)); // January 1, 2025 UTC
      const code = Code.fromDate(date);
      expect(code.toString()).toMatch(/^[0-9A-Z]{4}$/);
    });
  });

  describe("Code.fromUTC()", () => {
    it("should create from milliseconds timestamp", () => {
      const code = Code.fromUTC(Date.UTC(2024, 11, 6));
      expect(code.toString()).toBe("070Y");
    });

    it("should create from epoch timestamp", () => {
      const code = Code.fromUTC(EPOCH);
      expect(code.toString()).toBe("0000");
    });
  });

  describe("Code.fromDateString()", () => {
    it("should create from ISO date string", () => {
      const code = Code.fromDateString("2024-12-06");
      expect(code.toString()).toBe("070Y");
    });

    it("should create from ISO datetime string", () => {
      const code = Code.fromDateString("2024-12-06T00:00:00Z");
      expect(code.toString()).toBe("070Y");
    });

    it("should reject invalid date strings", () => {
      expect(() => Code.fromDateString("invalid-date")).toThrow("Invalid date string");
    });
  });

  describe("Code.fromCode()", () => {
    it("should parse valid code strings", () => {
      const code = Code.fromCode("070Y");
      expect(code.toString()).toBe("070Y");
    });

    it("should reject codes that are too short", () => {
      expect(() => Code.fromCode("07B")).toThrow("Code must be exactly 4 characters");
    });

    it("should reject codes that are too long", () => {
      expect(() => Code.fromCode("07B45")).toThrow("Code must be exactly 4 characters");
    });

    it("should reject codes with lowercase letters", () => {
      expect(() => Code.fromCode("070y")).toThrow(
        "Code must contain only uppercase letters and numbers"
      );
    });

    it("should reject codes with invalid characters", () => {
      expect(() => Code.fromCode("07B!")).toThrow(
        "Code must contain only uppercase letters and numbers"
      );
    });
  });

  describe("Code.toDate()", () => {
    it("should decode 0000 as epoch date", () => {
      const code = Code.fromCode("0000");
      const date = code.toDate();
      expect(date.getTime()).toBe(EPOCH);
    });

    it("should decode dates consistently", () => {
      const code = Code.fromCode("070Y");
      const date = code.toDate();
      expect(date.getTime()).toBe(Date.UTC(2024, 11, 6));
    });

    it("should decode 0001 as one day after epoch", () => {
      const code = Code.fromCode("0001");
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
        const code = Code.fromDate(originalDate);
        const decodedDate = code.toDate();
        // Compare by day (ignoring time components)
        expect(decodedDate.toISOString().split("T")[0]).toBe(
          originalDate.toISOString().split("T")[0]
        );
      }
    });
  });
}
