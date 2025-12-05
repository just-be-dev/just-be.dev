import { defineConfig, presetWind, transformerDirectives, transformerVariantGroup } from "unocss";
import type { Theme } from "@unocss/preset-wind";

export default defineConfig<Theme>({
  // Presets
  presets: [
    presetWind({
      dark: "class",
    }),
  ],

  // Transformers for CSS directives and variant groups
  transformers: [
    transformerDirectives(), // Enables @apply, @screen, etc.
    transformerVariantGroup(), // Enables hover:(bg-gray-400 font-medium)
  ],

  // Theme configuration
  theme: {
    // Breakpoints (match Tailwind defaults)
    breakpoints: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },

    // Colors - map to WebTUI CSS variables
    colors: {
      // Background levels (0-3)
      0: "var(--background0)",
      1: "var(--background1)",
      2: "var(--background2)",
      3: "var(--background3)",

      // Foreground levels (only use fg-0, fg-1, fg-2)
      fg: {
        0: "var(--foreground0)",
        1: "var(--foreground1)",
        2: "var(--foreground2)",
      },

      // Accent color
      accent: "var(--color-blue-0)",

      // Border colors (if needed)
      box: "var(--box-border-color)",
      table: "var(--table-border-color)",
      separator: "var(--separator-color)",
      "separator-bg": "var(--separator-background)",

      // ANSI colors (preserved for potential future use)
      black: {
        0: "#000000",
        1: "#555555",
      },
      red: {
        0: "#aa0000",
        1: "#ff5555",
      },
      green: {
        0: "#00aa00",
        1: "#55ff55",
      },
      yellow: {
        0: "#aa5500",
        1: "#ffff55",
      },
      blue: {
        0: "#0000aa",
        1: "#5555ff",
      },
      magenta: {
        0: "#aa00aa",
        1: "#ff55ff",
      },
      cyan: {
        0: "#00aaaa",
        1: "#55ffff",
      },
      white: {
        0: "#aaaaaa",
        1: "#ffffff",
      },
    },

    // Custom spacing system: ch horizontal, lh vertical
    spacing: {
      // Line-height units (vertical spacing)
      lh: "1lh",
      "2lh": "2lh",
      "3lh": "3lh",
    },
  },

  // Custom rules for ch-based spacing and lh-based sizing
  rules: [
    // Horizontal padding with ch units: px-1 = 1ch, px-2 = 2ch, etc.
    [
      /^px-([\d.]+)$/,
      ([, d]) => ({
        "padding-left": `calc(${d} * 1ch)`,
        "padding-right": `calc(${d} * 1ch)`,
      }),
    ],
    [/^pl-([\d.]+)$/, ([, d]) => ({ "padding-left": `calc(${d} * 1ch)` })],
    [/^pr-([\d.]+)$/, ([, d]) => ({ "padding-right": `calc(${d} * 1ch)` })],

    // Vertical padding with lh units: py-1 = 1lh, py-2 = 2lh, etc.
    [
      /^py-([\d.]+)$/,
      ([, d]) => ({
        "padding-top": `calc(${d} * 1lh)`,
        "padding-bottom": `calc(${d} * 1lh)`,
      }),
    ],
    [/^pt-([\d.]+)$/, ([, d]) => ({ "padding-top": `calc(${d} * 1lh)` })],
    [/^pb-([\d.]+)$/, ([, d]) => ({ "padding-bottom": `calc(${d} * 1lh)` })],

    // All-direction padding: p-1 uses ch for horizontal, lh for vertical
    [
      /^p-([\d.]+)$/,
      ([, d]) => ({
        "padding-left": `calc(${d} * 1ch)`,
        "padding-right": `calc(${d} * 1ch)`,
        "padding-top": `calc(${d} * 1lh)`,
        "padding-bottom": `calc(${d} * 1lh)`,
      }),
    ],

    // Horizontal margin with ch units
    [
      /^mx-([\d.]+)$/,
      ([, d]) => ({
        "margin-left": `calc(${d} * 1ch)`,
        "margin-right": `calc(${d} * 1ch)`,
      }),
    ],
    [/^ml-([\d.]+)$/, ([, d]) => ({ "margin-left": `calc(${d} * 1ch)` })],
    [/^mr-([\d.]+)$/, ([, d]) => ({ "margin-right": `calc(${d} * 1ch)` })],
    [
      /^-mx-([\d.]+)$/,
      ([, d]) => ({
        "margin-left": `calc(-${d} * 1ch)`,
        "margin-right": `calc(-${d} * 1ch)`,
      }),
    ],
    [/^-ml-([\d.]+)$/, ([, d]) => ({ "margin-left": `calc(-${d} * 1ch)` })],
    [/^-mr-([\d.]+)$/, ([, d]) => ({ "margin-right": `calc(-${d} * 1ch)` })],

    // Vertical margin with lh units
    [
      /^my-([\d.]+)$/,
      ([, d]) => ({
        "margin-top": `calc(${d} * 1lh)`,
        "margin-bottom": `calc(${d} * 1lh)`,
      }),
    ],
    [/^mt-([\d.]+)$/, ([, d]) => ({ "margin-top": `calc(${d} * 1lh)` })],
    [/^mb-([\d.]+)$/, ([, d]) => ({ "margin-bottom": `calc(${d} * 1lh)` })],
    [
      /^-my-([\d.]+)$/,
      ([, d]) => ({
        "margin-top": `calc(-${d} * 1lh)`,
        "margin-bottom": `calc(-${d} * 1lh)`,
      }),
    ],
    [/^-mt-([\d.]+)$/, ([, d]) => ({ "margin-top": `calc(-${d} * 1lh)` })],
    [/^-mb-([\d.]+)$/, ([, d]) => ({ "margin-bottom": `calc(-${d} * 1lh)` })],

    // All-direction margin
    [
      /^m-([\d.]+)$/,
      ([, d]) => ({
        "margin-left": `calc(${d} * 1ch)`,
        "margin-right": `calc(${d} * 1ch)`,
        "margin-top": `calc(${d} * 1lh)`,
        "margin-bottom": `calc(${d} * 1lh)`,
      }),
    ],

    // Height with lh units
    [/^h-(\d+)lh$/, ([, d]) => ({ height: `${d}lh` })],
    ["h-lh", { height: "1lh" }],

    // Top positioning with lh units
    [/^top-(\d+)lh$/, ([, d]) => ({ top: `${d}lh` })],
    ["top-lh", { top: "1lh" }],

    // Gap with ch units (horizontal) and lh units (vertical)
    [/^gap-([\d.]+)$/, ([, d]) => ({ gap: `calc(${d} * 1ch)` })],
    [/^gap-x-([\d.]+)$/, ([, d]) => ({ "column-gap": `calc(${d} * 1ch)` })],
    [/^gap-y-([\d.]+)$/, ([, d]) => ({ "row-gap": `calc(${d} * 1lh)` })],
  ],

  // Custom variants
  variants: [
    // hocus variant for hover + focus states
    (matcher) => {
      if (!matcher.startsWith("hocus:")) return matcher;
      return {
        matcher: matcher.slice(6), // Remove 'hocus:' prefix
        selector: (s) => `${s}:hover, ${s}:focus`,
      };
    },

    // group-hocus variant for group hover + focus
    (matcher) => {
      if (!matcher.startsWith("group-hocus:")) return matcher;
      return {
        matcher: matcher.slice(12), // Remove 'group-hocus:' prefix
        selector: (s) => `.group:hover ${s}, .group:focus ${s}`,
      };
    },
  ],

  // Safelist - classes that should always be generated
  safelist: [
    // Ensure core utilities are always available
    "flex",
    "block",
    "inline-block",
    "grid",
    "contents",
    "invert",
    "outline-none",
    "cursor-pointer",
    "cursor-help",
    "font-bold",
    "font-normal",
    "underline",
    "truncate",
    "group",
    "sr-only",
    "transition-filter",
    "transition-colors",
    "transition-all",
  ],

  // Content sources - where to scan for utility classes
  content: {
    filesystem: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  },
});
