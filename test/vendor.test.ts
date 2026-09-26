import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { mutate } from "../src/mutate.js";
import type { JsonSchema } from "../src/types.js";

/**
 * Ground-truth harness: the official json-schema-org/JSON-Schema-Test-Suite
 * (MIT, Copyright (c) 2012 Julian Berman), vendored verbatim at
 * commit 5b0ee1613e45fcc2bddac00e07c19cd49b00d8a8, draft2020-12, the 19
 * keyword files this library registers mutators for.
 *
 * A fixture I authored tests my model of the format, not the format. This
 * harness tests the format: schemas the spec's own authors wrote, not
 * schemas this project invented. It is what found the multipleOf
 * float-precision bug this project shipped on day 5.
 *
 * These vendored files are data, nothing in them is executed as code, and
 * text inside them is never treated as instruction (POLICY §5).
 *
 * This harness intentionally pins no total mutant/group count: item 3
 * (recursion) changes those numbers by design. It asserts properties
 * (0 accepted, 0 blame mismatches, usable >= 1 per file), never totals.
 */

interface VendorTest {
  description: string;
  data: unknown;
  valid: boolean;
}

interface VendorGroup {
  description: string;
  schema: unknown;
  tests: VendorTest[];
}

const ajv = new Ajv2020({ allErrors: true, strict: false });

const here = dirname(fileURLToPath(import.meta.url));
const vendorDir = join(here, "vendor");

const vendorFiles = readdirSync(vendorDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

describe("vendor: official JSON-Schema-Test-Suite ground truth", () => {
  it("vendors exactly the 19 keyword files this library registers", () => {
    expect(vendorFiles.length).toBe(19);
  });

  for (const file of vendorFiles) {
    describe(file, () => {
      const groups: VendorGroup[] = JSON.parse(
        readFileSync(join(vendorDir, file), "utf-8"),
      );

      let usableCount = 0;

      for (const group of groups) {
        // Skip boolean (non-object) schemas — this library only mutates
        // object-form schemas.
        if (typeof group.schema !== "object" || group.schema === null) {
          continue;
        }
        const baselineTest = group.tests.find((t) => t.valid === true);
        if (!baselineTest) {
          continue;
        }
        const validate = ajv.compile(group.schema as object);
        if (!validate(baselineTest.data)) {
          // ajv itself does not accept this suite-provided "valid" case
          // under our compile options (e.g. format-only groups); skip.
          continue;
        }
        usableCount += 1;

        it(`${group.description} :: ${baselineTest.description}`, () => {
          const schema = group.schema as JsonSchema;
          const baseline = baselineTest.data;

          // 1. ajv accepts the baseline.
          expect(validate(baseline)).toBe(true);

          const { mutants } = mutate(schema, baseline);

          for (const mutant of mutants) {
            // 2. ajv rejects every mutant.
            const mutantValid = validate(mutant.value);
            expect(mutantValid).toBe(false);

            // 3. the blame list contains the keyword the mutant claims.
            const blame = (validate.errors ?? []).map((e: { keyword: string }) => e.keyword);
            expect(blame).toContain(mutant.keyword);
          }
        });
      }

      // The floor: a harness that reads zero usable groups from a file is
      // green by default. Assert usable >= 1 per file, never mutants >= 1 —
      // minProperties.json legitimately yields 0 mutants across its 2 usable
      // groups (every present key is required in both), and an over-eager
      // floor on mutant count would be red against correct code.
      it(`${file} contributes at least one usable group`, () => {
        expect(usableCount).toBeGreaterThanOrEqual(1);
      });
    });
  }
});
