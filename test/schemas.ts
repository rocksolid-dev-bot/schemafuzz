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
];
