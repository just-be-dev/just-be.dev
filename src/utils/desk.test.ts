import { describe, expect, it } from "bun:test";
import { createDeskClient, parsePublicProjects, type DeskPlatformBinding } from "./desk";
import { deskFixture } from "./desk-fixture";

const quiet = () => {};

function fakeDesk(impl: () => Promise<unknown>) {
  let calls = 0;
  const binding: DeskPlatformBinding = {
    listPublicProjects: () => {
      calls++;
      return impl();
    },
  };
  return { binding, calls: () => calls };
}

describe("parsePublicProjects", () => {
  it("accepts the fixture", () => {
    expect(parsePublicProjects(deskFixture)).toHaveLength(deskFixture.length);
  });

  it("drops invalid and private projects and unknown link kinds", () => {
    const warnings: string[] = [];
    const [valid] = deskFixture;
    const result = parsePublicProjects(
      [
        { ...valid, links: [...valid.links, { kind: "mystery", ref: "x" }] },
        { ...valid, id: "private", visibility: "private" },
        { ...valid, id: "bad-state", state: "abandoned" },
      ],
      (message) => warnings.push(message),
    );
    expect(result.map((p) => p.id)).toEqual([valid.id]);
    expect(result[0].links).toEqual(valid.links);
    expect(warnings).toHaveLength(1);
  });

  it("requires a well-formed code, lowercasing it, and drops projects without one", () => {
    const warnings: string[] = [];
    const [valid] = deskFixture;
    const { code: _code, ...noCode } = valid;
    const result = parsePublicProjects(
      [
        { ...valid, id: "upper", code: "P252B" },
        { ...noCode, id: "missing" },
        { ...valid, id: "bad", code: "x1234" },
        { ...valid, id: "short", code: "p12" },
        valid,
      ],
      (message) => warnings.push(message),
    );
    expect(result.map((p) => [p.id, p.code])).toEqual([
      ["upper", "p252b"],
      [valid.id, valid.code],
    ]);
    expect(warnings).toHaveLength(3);
  });

  it("recognizes tagged errors structurally", () => {
    expect(() => parsePublicProjects({ _tag: "DeskUnavailable", message: "db down" })).toThrow(
      "Desk returned DeskUnavailable: db down",
    );
    expect(() => parsePublicProjects(null)).toThrow("expected an array");
  });
});

describe("createDeskClient", () => {
  it("reports a missing binding as unavailable", async () => {
    const client = createDeskClient({ binding: () => undefined, warn: quiet });
    expect(await client.listPublicProjects()).toMatchObject({ ok: false });
  });

  it("caches a good response while fresh", async () => {
    let now = 0;
    const desk = fakeDesk(async () => deskFixture);
    const client = createDeskClient({ binding: () => desk.binding, now: () => now, warn: quiet });

    expect(await client.listPublicProjects()).toMatchObject({ ok: true, stale: false });
    now = 59_000;
    await client.listPublicProjects();
    expect(desk.calls()).toBe(1);
    now = 61_000;
    await client.listPublicProjects();
    expect(desk.calls()).toBe(2);
  });

  it("shares one in-flight call", async () => {
    const desk = fakeDesk(async () => deskFixture);
    const client = createDeskClient({ binding: () => desk.binding, warn: quiet });
    await Promise.all([client.listPublicProjects(), client.listPublicProjects()]);
    expect(desk.calls()).toBe(1);
  });

  it("serves stale data while Desk fails, then backs off", async () => {
    let now = 0;
    let fail = false;
    const desk = fakeDesk(async () => {
      if (fail) throw new Error("boom");
      return deskFixture;
    });
    const client = createDeskClient({ binding: () => desk.binding, now: () => now, warn: quiet });

    await client.listPublicProjects();
    fail = true;
    now = 120_000;
    expect(await client.listPublicProjects()).toMatchObject({ ok: true, stale: true });
    expect(desk.calls()).toBe(2);

    // Within the retry window Desk isn't called again.
    now = 125_000;
    expect(await client.listPublicProjects()).toMatchObject({ ok: true, stale: true });
    expect(desk.calls()).toBe(2);

    // Past the stale window there is nothing to serve.
    now = 25 * 60 * 60_000;
    expect(await client.listPublicProjects()).toMatchObject({ ok: false, error: "boom" });
  });

  it("times out a hanging call", async () => {
    const desk = fakeDesk(() => new Promise(() => {}));
    const client = createDeskClient({ binding: () => desk.binding, timeoutMs: 10, warn: quiet });
    expect(await client.listPublicProjects()).toMatchObject({
      ok: false,
      error: "Desk did not answer within 10ms",
    });
  });

  it("treats a returned error value like a failed call", async () => {
    const down = createDeskClient({
      binding: () => fakeDesk(async () => ({ _tag: "Unavailable", message: "x" })).binding,
      warn: quiet,
    });
    expect(await down.listPublicProjects()).toMatchObject({
      ok: false,
      error: "Desk returned Unavailable: x",
    });

    let now = 0;
    let fail = false;
    const desk = fakeDesk(async () =>
      fail ? { _tag: "Unavailable", message: "D1 is down" } : deskFixture,
    );
    const client = createDeskClient({ binding: () => desk.binding, now: () => now, warn: quiet });
    await client.listPublicProjects();
    fail = true;
    now = 120_000;
    expect(await client.listPublicProjects()).toMatchObject({ ok: true, stale: true });
  });

  it("never throws when the binding throws synchronously", async () => {
    const client = createDeskClient({
      binding: () => ({
        listPublicProjects: () => {
          throw new Error("no such service");
        },
      }),
      warn: quiet,
    });
    expect(await client.listPublicProjects()).toMatchObject({ ok: false });
  });
});
