import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import { mutate, MUTATOR_KEYWORDS } from "../src/mutate.js";
import { fixtures } from "./schemas.js";

const ajv = new Ajv({ allErrors: true });

for (const fixture of fixtures) {
  describe(fixture.name, () => {
    it("accepts the baseline", () => {
      expect(ajv.validate(fixture.schema, fixture.baseline)).toBe(true);
    });

    const { mutants, skipped } = mutate(fixture.schema, fixture.baseline);

    if (fixture.expectMutants) {
      it("produces at least one mutant", () => {
        expect(mutants.length).toBeGreaterThan(0);
      });
    } else {
      it("produces no mutants (no counterexample exists)", () => {
        expect(mutants).toEqual([]);
      });
      it("explains why, via a non-empty skipped list", () => {
        expect(skipped.length).toBeGreaterThan(0);
      });
    }

    for (const mutant of mutants) {
      it(`rejects mutant [${mutant.keyword} @ "${mutant.path}"]: ${mutant.reason}`, () => {
        expect(
          ajv.validate(fixture.schema, mutant.value),
          `expected ajv to reject the "${mutant.keyword}" mutant at "${mutant.path}" (${mutant.reason})`
        ).toBe(false);
      });
    }

    if (mutants.length > 0) {
      it(`is rejected for the keyword it claims`, () => {
        const validate = ajv.compile(fixture.schema);
        for (const mutant of mutants) {
          const accepted = validate(mutant.value);
          expect(accepted).toBe(false);
          const blamed = (validate.errors ?? []).map((e) => e.keyword);
          expect(blamed).toContain(mutant.keyword);
        }
      });
    }

    if (fixture.expectSkippedKeywords) {
      it(`reports the un-negatable keywords as skipped`, () => {
        const keywords = skipped.map((s) => s.keyword);
        for (const expected of fixture.expectSkippedKeywords!) {
          expect(keywords).toContain(expected);
        }
      });
    }
  });
}

const emittedKeywords = new Set(
  fixtures.flatMap((f) => mutate(f.schema, f.baseline).mutants.map((m) => m.keyword))
);

describe("mutator coverage", () => {
  for (const keyword of MUTATOR_KEYWORDS) {
    it(`the fixture set exercises the ${keyword} mutator`, () => {
      expect([...emittedKeywords]).toContain(keyword);
    });
  }
});

describe("recursion into nested schemas (one level)", () => {
  const canonical = fixtures.find(
    (f) => f.name === "object with nested minLength via properties recursion"
  )!;
  const arrayCase = fixtures.find(
    (f) => f.name === "array with minLength-constrained items via items recursion"
  )!;

  it("splices a nested minLength mutant into properties at /name", () => {
    const { mutants } = mutate(canonical.schema, canonical.baseline);
    const nested = mutants.find((m) => m.keyword === "minLength" && m.path === "/name");
    expect(nested).toBeDefined();
  });

  it("splices a nested minLength mutant into items at a numeric index", () => {
    const { mutants } = mutate(arrayCase.schema, arrayCase.baseline);
    const nested = mutants.find((m) => m.keyword === "minLength" && /^\/\d+$/.test(m.path));
    expect(nested).toBeDefined();
  });

  it("no longer claims the root has no minLength to negate", () => {
    const { skipped } = mutate(canonical.schema, canonical.baseline);
    expect(skipped.filter((s) => s.keyword === "minLength" && s.path === "")).toEqual([]);
  });

  it("at least one skipped entry across the fixture set carries a non-empty path", () => {
    const allSkipped = fixtures.flatMap((f) => mutate(f.schema, f.baseline).skipped);
    expect(allSkipped.some((s) => s.path !== "")).toBe(true);
  });

  const rootSkips = (schema: any, baseline: any) =>
    mutate(schema, baseline).skipped.filter((s) => s.path === "").length;
  const hasRootMinLength = (schema: any, baseline: any) =>
    mutate(schema, baseline).skipped.some((s) => s.keyword === "minLength" && s.path === "");

  it("canonical fixture: 15 root skips, minLength absent from the root skip list", () => {
    expect(rootSkips(canonical.schema, canonical.baseline)).toBe(15);
    expect(hasRootMinLength(canonical.schema, canonical.baseline)).toBe(false);
  });

  it("control (canonical minus minLength): 16 root skips, minLength present", () => {
    const schema = {
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" } },
    };
    const baseline = { name: "Ada" };
    expect(rootSkips(schema, baseline)).toBe(16);
    expect(hasRootMinLength(schema, baseline)).toBe(true);
  });

  it("items fixture: 16 root skips, minLength absent from the root skip list", () => {
    expect(rootSkips(arrayCase.schema, arrayCase.baseline)).toBe(16);
    expect(hasRootMinLength(arrayCase.schema, arrayCase.baseline)).toBe(false);
  });

  it("control (items minus minLength): 17 root skips, minLength present", () => {
    const schema = {
      type: "array",
      items: { type: "string" },
    };
    const baseline = ["abc", "def"];
    expect(rootSkips(schema, baseline)).toBe(17);
    expect(hasRootMinLength(schema, baseline)).toBe(true);
  });
});

describe("allOf as a recursion site", () => {
  const scalarCase = fixtures.find(
    (f) => f.name === "string constrained by two allOf branches (recursion site, not a mutator)"
  )!;
  const objectCase = fixtures.find(
    (f) => f.name === "object where one allOf branch nests into properties"
  )!;

  it("MUTATOR_KEYWORDS stays 19 — allOf registers no mutator of its own", () => {
    expect(MUTATOR_KEYWORDS.length).toBe(19);
    expect(MUTATOR_KEYWORDS).not.toContain("allOf");
  });

  it("scalar case: 2 branch mutants, both at path '', skipped 18 -> 16", () => {
    const { mutants, skipped } = mutate(scalarCase.schema, scalarCase.baseline);
    expect(mutants).toHaveLength(2);
    expect(mutants.find((m) => m.keyword === "type" && m.path === "" && m.value === 3.14)).toBeDefined();
    expect(mutants.find((m) => m.keyword === "minLength" && m.path === "" && m.value === "aa")).toBeDefined();
    expect(skipped).toHaveLength(16);
    expect(skipped.some((s) => s.keyword === "minLength" && s.path === "")).toBe(false);
    expect(skipped.some((s) => s.keyword === "type" && s.path === "")).toBe(false);
  });

  it("object case: 4 branch mutants (root + nested), skipped 18 -> 15", () => {
    const { mutants, skipped } = mutate(objectCase.schema, objectCase.baseline);
    expect(mutants).toHaveLength(4);
    expect(mutants.find((m) => m.keyword === "type" && m.path === "")).toBeDefined();
    expect(mutants.find((m) => m.keyword === "required" && m.path === "/a")).toBeDefined();
    expect(mutants.find((m) => m.keyword === "type" && m.path === "/a")).toBeDefined();
    expect(mutants.find((m) => m.keyword === "minLength" && m.path === "/a")).toBeDefined();
    expect(skipped).toHaveLength(15);
  });

  it("nested allOf terminates and flattens to 3 mutants, all at path ''", () => {
    const schema = {
      allOf: [{ allOf: [{ type: "string" }, { minLength: 3 }] }, { maxLength: 8 }],
    };
    const { mutants } = mutate(schema, "abcd");
    expect(mutants).toHaveLength(3);
    expect(mutants.map((m) => m.keyword).sort()).toEqual(["maxLength", "minLength", "type"]);
    expect(mutants.every((m) => m.path === "")).toBe(true);
  });
});

describe("allOf branch skips (reason, not presence)", () => {
  it("A: branch has an honest reason for a keyword the root reports generically -> root converges on the branch's reason", () => {
    const schema = { allOf: [{ type: "object" }, { minProperties: 1 }] };
    const { skipped } = mutate(schema, { a: 1, b: 2 });
    const rootSkips = skipped.filter((s) => s.path === "");
    expect(rootSkips).toHaveLength(17);
    const mp = rootSkips.find((s) => s.keyword === "minProperties");
    expect(mp?.reason).toBe(
      'dropping non-required key "a" still leaves 1 properties, at or above minProperties 1'
    );
  });

  it("B: root-level control reports the same honest reason directly, unchanged", () => {
    const schema = { type: "object", minProperties: 1 };
    const { skipped } = mutate(schema, { a: 1, b: 2 });
    const rootSkips = skipped.filter((s) => s.path === "");
    expect(rootSkips).toHaveLength(17);
    const mp = rootSkips.find((s) => s.keyword === "minProperties");
    expect(mp?.reason).toBe(
      'dropping non-required key "a" still leaves 1 properties, at or above minProperties 1'
    );
  });

  it("C: branch truly has no minProperties -> the generic absence reason survives, unchanged", () => {
    const schema = { allOf: [{ type: "object" }, { maxProperties: 5 }] };
    const { skipped } = mutate(schema, { a: 1, b: 2 });
    const rootSkips = skipped.filter((s) => s.path === "");
    expect(rootSkips).toHaveLength(16);
    const mp = rootSkips.find((s) => s.keyword === "minProperties");
    expect(mp?.reason).toBe("schema has no minProperties keyword to negate");
  });

  it("D: branch negates the keyword -> no root skip for it at all (existing filter, unmoved)", () => {
    const schema = { allOf: [{ type: "object" }, { minProperties: 2 }] };
    const { skipped } = mutate(schema, { a: 1, b: 2 });
    const rootSkips = skipped.filter((s) => s.path === "");
    expect(rootSkips).toHaveLength(16);
    expect(rootSkips.find((s) => s.keyword === "minProperties")).toBeUndefined();
  });
});
