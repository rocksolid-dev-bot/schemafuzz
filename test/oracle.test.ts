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
});
