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
  },
  {
    name: "plain string",
    schema: { type: "string", minLength: 2 },
    baseline: "hello",
  },
  {
    name: "number or null",
    schema: { type: ["number", "null"] },
    baseline: 42,
  },
];
