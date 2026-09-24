import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import { mutate } from "../src/mutate.js";
import { fixtures } from "./schemas.js";

const ajv = new Ajv();

for (const fixture of fixtures) {
  describe(fixture.name, () => {
    it("accepts the baseline", () => {
      expect(ajv.validate(fixture.schema, fixture.baseline)).toBe(true);
    });

    const { mutants } = mutate(fixture.schema, fixture.baseline);

    it("produces at least one mutant", () => {
      expect(mutants.length).toBeGreaterThan(0);
    });

    for (const mutant of mutants) {
      it(`rejects mutant [${mutant.keyword} @ "${mutant.path}"]: ${mutant.reason}`, () => {
        expect(
          ajv.validate(fixture.schema, mutant.value),
          `expected ajv to reject the "${mutant.keyword}" mutant at "${mutant.path}" (${mutant.reason})`
        ).toBe(false);
      });
    }
  });
}
