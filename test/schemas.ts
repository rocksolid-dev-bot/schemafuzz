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
  {
    name: "array with minItems",
    schema: { type: "array", items: { type: "number" }, minItems: 2 },
    baseline: [1, 2, 3],
    expectMutants: true,
  },
  {
    // Extends with new unique values (not a duplicate), so the blame list is
    // ["maxItems"] alone rather than confounded with uniqueItems.
    name: "array with maxItems",
    schema: { type: "array", items: { type: "number" }, maxItems: 3 },
    baseline: [1, 2],
    expectMutants: true,
  },
  {
    name: "array with uniqueItems",
    schema: { type: "array", items: { type: "number" }, uniqueItems: true },
    baseline: [1, 2],
    expectMutants: true,
  },
  {
    name: "object with additionalProperties false",
    schema: {
      type: "object",
      properties: { a: { type: "number" } },
      additionalProperties: false,
    },
    baseline: { a: 1 },
    expectMutants: true,
  },
  {
    // Drops a non-required key ("b"), not a required one, so the blame list
    // is ["minProperties"] alone rather than confounded with required.
    name: "object with minProperties and a required key",
    schema: { type: "object", required: ["a"], minProperties: 2 },
    baseline: { a: 1, b: 2 },
    expectMutants: true,
  },
  {
    name: "object with maxProperties",
    schema: { type: "object", maxProperties: 2 },
    baseline: { a: 1, b: 2 },
    expectMutants: true,
  },
  {
    name: "object with propertyNames pattern",
    schema: { type: "object", propertyNames: { pattern: "^[a-z]+$" } },
    baseline: { abc: 1 },
    expectMutants: true,
  },
  {
    name: "array with minItems 0 (unnegatable)",
    schema: { type: "array", minItems: 0 },
    baseline: [],
    expectMutants: true,
    expectSkippedKeywords: ["minItems"],
  },
  {
    name: "array with uniqueItems false (unnegatable)",
    schema: { type: "array", uniqueItems: false },
    baseline: [1, 1],
    expectMutants: true,
    expectSkippedKeywords: ["uniqueItems"],
  },
  {
    name: "object where every present key is required (minProperties unnegatable)",
    schema: { type: "object", required: ["a"], minProperties: 1 },
    baseline: { a: 1 },
    expectMutants: true,
    expectSkippedKeywords: ["minProperties"],
  },
];
