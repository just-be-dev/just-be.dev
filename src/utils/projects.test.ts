import { describe, expect, it } from "bun:test";
import type { DeskResult } from "./desk";
import { deskFixture } from "./desk-fixture";
import { joinProjects, listProjects, type MdxProject } from "./projects";

const mdx = (id: string, data: MdxProject["data"] = {}): MdxProject => ({ id, data });

const desk = (projects = deskFixture): DeskResult => ({
  ok: true,
  projects,
  source: "fixture",
  stale: false,
});

const entries = [
  mdx("pex", { date: new Date("2026-01-24"), code: "p2530" }),
  mdx("jexl", { title: "JEXL!", description: "Override", code: "p2424" }),
  mdx("webview", { date: new Date("2024-09-16"), code: "p3a89" }),
  mdx("private-thing", { code: "p1111" }),
];

describe("joinProjects", () => {
  const { deskAvailable, projects } = joinProjects(desk(), entries);
  const bySlug = (slug: string) => projects.find((p) => p.slug === slug);

  it("joins Desk projects to MDX by site link", () => {
    expect(deskAvailable).toBe(true);
    expect(bySlug("pex")).toMatchObject({
      title: "PEX Lang",
      state: "active",
      code: "P2530",
      url: "https://pex.just-be.dev",
      github: "https://github.com/just-be-dev/pex",
    });
    expect(bySlug("pex")?.entry?.id).toBe("pex");
  });

  it("lets MDX override title and description", () => {
    expect(bySlug("jexl")).toMatchObject({
      title: "JEXL!",
      description: "Override",
      experimental: true,
    });
  });

  it("falls back to Desk's createdAt for the date", () => {
    expect(bySlug("jexl")?.date?.toISOString()).toBe("2025-05-01T00:00:00.000Z");
  });

  it("gives public Desk projects without MDX a page", () => {
    expect(bySlug("fixture-desk-only")).toMatchObject({ state: "done", entry: undefined });
    // Site-linked projects whose MDX is missing still get a page from Desk data.
    expect(bySlug("ccpm")).toMatchObject({ title: "CCPM", entry: undefined });
  });

  it("hides MDX whose project isn't public in Desk", () => {
    expect(bySlug("private-thing")).toBeUndefined();
  });

  it("doesn't let a Desk-only project take an MDX slug", () => {
    const [pex] = deskFixture.filter((p) => p.slug === "pex");
    const clash = { ...pex, id: "clash", links: [] };
    const warnings: string[] = [];
    const result = joinProjects(desk([clash, pex]), entries, (m) => warnings.push(m));
    expect(result.projects.map((p) => p.desk?.id)).toEqual([pex.id]);
    expect(warnings).toHaveLength(1);
  });

  it("degrades to MDX only when Desk is unavailable", () => {
    const result = joinProjects({ ok: false, error: "down" }, entries);
    expect(result.deskAvailable).toBe(false);
    expect(result.projects.map((p) => p.slug)).toEqual(entries.map((e) => e.id));
    expect(result.projects[0]).toMatchObject({ title: "pex", code: "P2530" });
    expect(result.projects[0].state).toBeUndefined();
  });
});

describe("listProjects", () => {
  it("orders by state with archived last and hides ideas", () => {
    const { projects } = joinProjects(desk(), entries);
    const listed = listProjects(projects);
    expect(listed.map((p) => p.state)).toEqual([
      "active",
      "active",
      "active",
      "active",
      "active",
      "active",
      "maintenance",
      "done",
      "archived",
    ]);
    expect(listed.some((p) => p.slug === "fixture-idea")).toBe(false);
  });

  it("orders newest first within a state", () => {
    const { projects } = joinProjects(desk(), entries);
    const active = listProjects(projects).filter((p) => p.state === "active");
    expect(active.map((p) => p.slug)).toEqual([
      "webview-cli",
      "pex",
      "ccpm",
      "jexl",
      "side-project-saturday",
      "devtools-fm",
    ]);
  });
});
