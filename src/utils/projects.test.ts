import { describe, expect, it } from "bun:test";
import type { DeskResult } from "./desk";
import { deskFixture } from "./desk-fixture";
import {
  joinProjects,
  listProjects,
  projectAliasPath,
  projectCodePath,
  type MdxProject,
} from "./projects";

const mdx = (id: string, data: MdxProject["data"] = {}): MdxProject => ({ id, data });

const desk = (projects = deskFixture): DeskResult => ({
  ok: true,
  projects,
  source: "fixture",
  stale: false,
});

const entries = [
  mdx("pex", { date: new Date("2026-01-24"), slugs: ["/pex"] }),
  mdx("jexl", { title: "JEXL!", description: "Override", slugs: ["/jexl"] }),
  mdx("webview", { date: new Date("2024-09-16") }),
  mdx("private-thing"),
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

  it("drops a url link that duplicates the github link", () => {
    const [ccpm] = deskFixture.filter((p) => p.slug === "ccpm");
    const withUrl = {
      ...ccpm,
      links: [...ccpm.links, { kind: "url" as const, ref: "https://github.com/just-be-dev/ccpm/" }],
    };
    const [project] = joinProjects(desk([withUrl]), []).projects;
    expect(project.url).toBeUndefined();
    expect(project.github).toBe("https://github.com/just-be-dev/ccpm");
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

  it("takes codes from Desk, including Desk-only projects", () => {
    expect(bySlug("fixture-desk-only")?.code).toBe("P24DD");
    expect(bySlug("ccpm")?.code).toBe("P252B");
  });

  it("degrades to MDX only when Desk is unavailable", () => {
    const result = joinProjects({ ok: false, error: "down" }, entries);
    expect(result.deskAvailable).toBe(false);
    expect(result.projects.map((p) => p.slug)).toEqual(entries.map((e) => e.id));
    expect(result.projects[0]).toMatchObject({ title: "pex" });
    expect(result.projects[0].state).toBeUndefined();
    expect(result.projects.every((p) => p.code === undefined)).toBe(true);
  });
});

describe("projectCodePath", () => {
  const { projects } = joinProjects(desk(), entries);

  it("redirects a code to the slug the join picked, in any case", () => {
    expect(projectCodePath("p2530", projects)).toBe("/projects/pex");
    expect(projectCodePath("P2530", projects)).toBe("/projects/pex");
    expect(projectCodePath("p24dd", projects)).toBe("/projects/fixture-desk-only");
  });

  it("uses the site link, not the Desk slug", () => {
    const [pex] = deskFixture.filter((p) => p.slug === "pex");
    const renamed = { ...pex, slug: "pex-lang" };
    const joined = joinProjects(desk([renamed]), entries).projects;
    expect(projectCodePath("p2530", joined)).toBe("/projects/pex");
  });

  it("returns undefined for codes without a public project", () => {
    expect(projectCodePath("p0000", projects)).toBeUndefined();
    const onlyPex = deskFixture.filter((p) => p.slug === "pex");
    const joined = joinProjects(desk(onlyPex), entries).projects;
    expect(projectCodePath("p2424", joined)).toBeUndefined();
  });

  it("resolves nothing when Desk is unavailable", () => {
    const joined = joinProjects({ ok: false, error: "down" }, entries).projects;
    expect(projectCodePath("p2530", joined)).toBeUndefined();
    expect(projectCodePath("p24dd", joined)).toBeUndefined();
  });
});

describe("projectAliasPath", () => {
  it("redirects MDX slugs aliases to the project's page", () => {
    expect(projectAliasPath("/pex", entries)).toBe("/projects/pex");
    expect(projectAliasPath("/jexl/", entries)).toBe("/projects/jexl");
  });

  it("leaves other paths alone", () => {
    expect(projectAliasPath("/projects/pex", entries)).toBeUndefined();
    expect(projectAliasPath("/webview", entries)).toBeUndefined();
    expect(projectAliasPath("/", entries)).toBeUndefined();
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
