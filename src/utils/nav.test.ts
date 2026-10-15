import { describe, expect, it } from "bun:test";
import { highlightLabel, isActive, isCurrent } from "./nav";

describe("nav", () => {
  it("marks a tab active anywhere in its section", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/blog")).toBe(false);
    expect(isActive("/blog", "/blog/post")).toBe(true);
    expect(isActive("/blog", "/traces")).toBe(false);
  });

  it("marks a tab current only on its own page", () => {
    expect(isCurrent("/blog", "/blog/")).toBe(true);
    expect(isCurrent("/blog", "/blog/post")).toBe(false);
    expect(isCurrent("/", "/")).toBe(true);
  });

  it("splits the label around its shortcut key", () => {
    expect(highlightLabel("home", "o")).toEqual({ before: "h", key: "o", after: "me" });
    expect(highlightLabel("blog", "z")).toEqual({ before: "blog", key: "", after: "" });
  });
});
