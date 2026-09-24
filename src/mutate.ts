import type { JsonSchema, JsonType, Mutant, MutateResult, Skipped } from "./types.js";

/** One representative value per JSON type, used as "a value of a different type". */
const TYPE_CANDIDATES: Record<Exclude<JsonType, "integer">, unknown> = {
  string: "mutant-string",
  number: 3.14,
  boolean: true,
  object: { mutant: true },
  array: ["mutant"],
  null: null,
};

/** Escape a single JSON Pointer path segment (RFC 6901: ~ -> ~0, / -> ~1). */
function escapeToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

function typeMutator(schema: JsonSchema, _baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  if (schema.type === undefined) {
    skipped.push({
      keyword: "type",
      path: "",
      reason: "schema has no type keyword to negate",
    });
    return { mutants, skipped };
  }

  const allowed = new Set(
    Array.isArray(schema.type) ? schema.type : [schema.type]
  );

  const candidateTypes = (Object.keys(TYPE_CANDIDATES) as Array<
    Exclude<JsonType, "integer">
  >).filter((t) => !allowed.has(t));

  if (candidateTypes.length === 0) {
    skipped.push({
      keyword: "type",
      path: "",
      reason: "every representable JSON type is already allowed by this schema",
    });
    return { mutants, skipped };
  }

  const chosen = candidateTypes[0];
  mutants.push({
    value: TYPE_CANDIDATES[chosen],
    keyword: "type",
    path: "",
    reason: `replaced instance with a ${chosen} value, outside allowed type(s) [${[...allowed].join(", ")}]`,
  });

  return { mutants, skipped };
}

function requiredMutator(schema: JsonSchema, baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  if (schema.required === undefined) {
    skipped.push({
      keyword: "required",
      path: "",
      reason: "schema has no required keyword to negate",
    });
    return { mutants, skipped };
  }

  if (
    typeof baseline !== "object" ||
    baseline === null ||
    Array.isArray(baseline)
  ) {
    skipped.push({
      keyword: "required",
      path: "",
      reason: "baseline is not a JSON object, so no property can be deleted",
    });
    return { mutants, skipped };
  }

  const baselineObj = baseline as Record<string, unknown>;

  for (const name of schema.required) {
    if (!(name in baselineObj)) {
      skipped.push({
        keyword: "required",
        path: `/${escapeToken(name)}`,
        reason: `baseline does not have property "${name}" to delete`,
      });
      continue;
    }
    const mutated: Record<string, unknown> = { ...baselineObj };
    delete mutated[name];
    mutants.push({
      value: mutated,
      keyword: "required",
      path: `/${escapeToken(name)}`,
      reason: `deleted required property "${name}"`,
    });
  }

  return { mutants, skipped };
}

/**
 * Generate the mutants (values that must be rejected) and skipped negations
 * (keywords this version cannot negate for this schema) for a schema and a
 * baseline value the schema is expected to accept.
 *
 * Never throws: an unmutatable schema is a returned `skipped` entry, not an
 * error.
 */
export function mutate(schema: JsonSchema, baseline: unknown): MutateResult {
  const results = [typeMutator(schema, baseline), requiredMutator(schema, baseline)];

  const mutants = results.flatMap((r) => r.mutants);
  const skipped = results.flatMap((r) => r.skipped);

  return { mutants, skipped };
}
