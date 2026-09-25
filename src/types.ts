/** A JSON value of a distinguishable JSON type, used to pick "a different type" values. */
export type JsonType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "null";

/**
 * A single counterexample: a value that should be rejected by the schema, plus
 * the keyword it violates, a JSON Pointer to where it was inserted, and a
 * human-readable reason.
 */
export interface Mutant {
  value: unknown;
  keyword: string;
  path: string;
  reason: string;
}

/**
 * A keyword this version of the mutator cannot negate for a given schema/path.
 * Not an error — some schemas have no counterexample for a given keyword, or
 * the keyword's negation is out of scope for this version.
 */
export interface Skipped {
  keyword: string;
  path: string;
  reason: string;
}

export interface MutateResult {
  mutants: Mutant[];
  skipped: Skipped[];
}

/**
 * The minimal shape of a JSON Schema this version of the mutator understands.
 * Deliberately loose — schemas are untrusted data, not a type we control.
 */
export interface JsonSchema {
  type?: JsonType | JsonType[];
  required?: string[];
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: unknown[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  additionalProperties?: boolean;
  minProperties?: number;
  maxProperties?: number;
  propertyNames?: JsonSchema;
  [key: string]: unknown;
}
