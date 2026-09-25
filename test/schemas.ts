import type { JsonSchema } from "../src/types.js";

/**
 * Hand-written schema + baseline pairs for the oracle harness. Self-authored
 * on day 1; day 3 vendors the official JSON-Schema-Test-Suite so the happy
 * path is checked against schemas the spec's own authors wrote, not schemas
 * this project invented.
 */
export interface Fixture {
  name: string;
  schema: JsonSchema;
  /** A value the schema must accept. */
  baseline: unknown;
  /**
   * Whether this fixture is expected to yield at least one mutant. False for
   * an unconstrained schema (e.g. `{}`), which has no counterexample: "no
   * mutant exists" is a returned value (a non-empty `skipped`), not a
   * failure.
   */
  expectMutants: boolean;
  /** Keywords that must appear in `skipped` for this fixture: the negation provably does not exist. */
  expectSkippedKeywords?: string[];
}

export const fixtures: Fixture[] = [
  {
    name: "object with a required string property",
    schema: {
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" } },
    },
    baseline: { name: "Ada" },
    expectMutants: true,
  },
  {
    name: "plain string",
    schema: { type: "string", minLength: 2 },
    baseline: "hello",
    expectMutants: true,
  },
  {
    name: "number or null",
    schema: { type: ["number", "null"] },
    baseline: 42,
    expectMutants: true,
  },
  {
    name: "unconstrained schema (no counterexample)",
    schema: {},
    baseline: { a: 1 },
    expectMutants: false,
  },
  {
    name: "string with minLength and maxLength",
    schema: { type: "string", minLength: 3, maxLength: 8 },
    baseline: "hello",
    expectMutants: true,
  },
  {
    name: "string with minLength 0 (unnegatable)",
    schema: { type: "string", minLength: 0 },
    baseline: "hi",
    expectMutants: true,
    expectSkippedKeywords: ["minLength"],
  },
  {
    name: "string with a negatable pattern",
    schema: { type: "string", pattern: "^[0-9]{3}$" },
    baseline: "123",
    expectMutants: true,
  },
  {
    name: "string with an unnegatable pattern",
    schema: { type: "string", pattern: "^.*$" },
    baseline: "x",
    expectMutants: true,
    expectSkippedKeywords: ["pattern"],
  },
  {
    name: "string enum",
    schema: { type: "string", enum: ["a", "b"] },
    baseline: "a",
    expectMutants: true,
  },
  {
    name: "const",
    schema: { const: 42 },
    baseline: 42,
    expectMutants: true,
  },
  {
    name: "number with minimum and maximum",
    schema: { type: "number", minimum: 0, maximum: 10 },
    baseline: 5,
    expectMutants: true,
  },
  {
    name: "number with exclusiveMinimum and exclusiveMaximum",
    schema: { type: "number", exclusiveMinimum: 0, exclusiveMaximum: 10 },
    baseline: 5,
    expectMutants: true,
  },
  {
    name: "integer with minimum and multipleOf",
    schema: { type: "integer", minimum: 0, multipleOf: 2 },
    baseline: 4,
    expectMutants: true,
  },
  {
    // Baseline is 0.2, not 0.3: measured against ajv 8, 0.3 / 0.1 is
    // 2.9999999999999996 in IEEE-754, so ajv rejects the baseline itself.
    // 0.2 / 0.1 === 2 exactly, so it is a clean baseline.
    name: "number with multipleOf (float baseline)",
    schema: { type: "number", multipleOf: 0.1 },
    baseline: 0.2,
    expectMutants: true,
  },
];
