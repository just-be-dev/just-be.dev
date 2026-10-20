import { describe, expect, it } from "bun:test";
import { aliasTarget, canonicalPath, type ManifestPath } from "./url-manifest";

const paths: ManifestPath[] = [
  { id: "/jexl", data: { code: "p2424" } },
  { id: "/projects/jexl", data: { code: "p2424" } },
  { id: "/projects/pex", data: { code: "p2530" } },
  { id: "/pex", data: { code: "p2530" } },
  { id: "/blog/old-name", data: { code: "b2405" } },
  { id: "/blog/new-name", data: { code: "b2405" } },
];

describe("canonicalPath", () => {
  it("prefers the path under the code's collection", () => {
    expect(canonicalPath("p2424", paths)).toBe("/projects/jexl");
    expect(canonicalPath("P2530", paths)).toBe("/projects/pex");
  });

  it("prefers the newest path after a rename", () => {
    expect(canonicalPath("b2405", paths)).toBe("/blog/new-name");
  });

  it("returns undefined for unknown codes", () => {
    expect(canonicalPath("t0000", paths)).toBeUndefined();
  });
});

describe("aliasTarget", () => {
  it("redirects aliases to the canonical page", () => {
    expect(aliasTarget("/pex", paths)).toBe("/projects/pex");
    expect(aliasTarget("/jexl/", paths)).toBe("/projects/jexl");
    expect(aliasTarget("/blog/old-name", paths)).toBe("/blog/new-name");
  });

  it("leaves canonical and unknown paths alone", () => {
    expect(aliasTarget("/projects/pex", paths)).toBeUndefined();
    expect(aliasTarget("/about", paths)).toBeUndefined();
    expect(aliasTarget("/", paths)).toBeUndefined();
  });
});
