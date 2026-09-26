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

function minLengthMutator(schema: JsonSchema, _baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  const n = schema.minLength;
  if (typeof n !== "number") {
    skipped.push({
      keyword: "minLength",
      path: "",
      reason: "schema has no minLength keyword to negate",
    });
    return { mutants, skipped };
  }

  if (n <= 0) {
    skipped.push({
      keyword: "minLength",
      path: "",
      reason: `minLength ${n} has no shorter non-negative-length string to build`,
    });
    return { mutants, skipped };
  }

  mutants.push({
    value: "a".repeat(n - 1),
    keyword: "minLength",
    path: "",
    reason: `built an ASCII string of length ${n - 1}, below minLength ${n}`,
  });

  return { mutants, skipped };
}

function maxLengthMutator(schema: JsonSchema, _baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  const n = schema.maxLength;
  if (typeof n !== "number") {
    skipped.push({
      keyword: "maxLength",
      path: "",
      reason: "schema has no maxLength keyword to negate",
    });
    return { mutants, skipped };
  }

  if (!Number.isInteger(n) || n < 0) {
    skipped.push({
      keyword: "maxLength",
      path: "",
      reason: `maxLength ${n} is not a non-negative integer`,
    });
    return { mutants, skipped };
  }

  if (n > 10000) {
    skipped.push({
      keyword: "maxLength",
      path: "",
      reason: `maxLength ${n} is too large to allocate a mutant string for`,
    });
    return { mutants, skipped };
  }

  mutants.push({
    value: "a".repeat(n + 1),
    keyword: "maxLength",
    path: "",
    reason: `built an ASCII string of length ${n + 1}, above maxLength ${n}`,
  });

  return { mutants, skipped };
}

/** Ordered candidate pool for negating `pattern`. JSON Schema `pattern` is
 * unanchored (measured: `{pattern: "abc"}` accepts `"xxabcxx"`), so testing
 * each candidate with `re.test()` asks exactly the question ajv will ask. */
const PATTERN_CANDIDATES = ["schemafuzz-pattern-mutant", "!", "\u0000", ""];

function patternMutator(schema: JsonSchema, _baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  const p = schema.pattern;
  if (typeof p !== "string") {
    skipped.push({
      keyword: "pattern",
      path: "",
      reason: "schema has no pattern keyword to negate",
    });
    return { mutants, skipped };
  }

  let re: RegExp;
  try {
    re = new RegExp(p);
  } catch {
    skipped.push({
      keyword: "pattern",
      path: "",
      reason: `pattern "${p}" is not a valid RegExp`,
    });
    return { mutants, skipped };
  }

  const candidate = PATTERN_CANDIDATES.find((c) => !re.test(c));
  if (candidate === undefined) {
    skipped.push({
      keyword: "pattern",
      path: "",
      reason: `pattern "${p}" matches every candidate in the negation pool`,
    });
    return { mutants, skipped };
  }

  mutants.push({
    value: candidate,
    keyword: "pattern",
    path: "",
    reason: `candidate ${JSON.stringify(candidate)} does not match pattern "${p}"`,
  });

  return { mutants, skipped };
}

/** Ordered candidate pool for negating `enum`/`const` (a one-member enum). */
const ENUM_CANDIDATES: unknown[] = [
  "schemafuzz-not-a-member",
  0,
  null,
  false,
  { schemafuzz: "not-a-member" },
];

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  );
}

function enumConstMutator(schema: JsonSchema, _baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  const members = schema.enum !== undefined
    ? (schema.enum as unknown[])
    : schema.const !== undefined
      ? [schema.const]
      : undefined;
  const keyword = schema.enum !== undefined ? "enum" : "const";

  if (members === undefined) {
    skipped.push({
      keyword: "enum",
      path: "",
      reason: "schema has no enum or const keyword to negate",
    });
    return { mutants, skipped };
  }

  const candidate = ENUM_CANDIDATES.find(
    (c) => !members.some((m) => deepEqual(m, c))
  );

  if (candidate === undefined) {
    skipped.push({
      keyword,
      path: "",
      reason: `every candidate in the negation pool is already a member of the ${keyword}`,
    });
    return { mutants, skipped };
  }

  mutants.push({
    value: candidate,
    keyword,
    path: "",
    reason: `candidate ${JSON.stringify(candidate)} is not a member of the ${keyword}`,
  });

  return { mutants, skipped };
}

function minimumMutator(schema: JsonSchema, _baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  const m = schema.minimum;
  if (typeof m !== "number") {
    skipped.push({
      keyword: "minimum",
      path: "",
      reason: "schema has no minimum keyword to negate",
    });
    return { mutants, skipped };
  }

  mutants.push({
    value: m - 1,
    keyword: "minimum",
    path: "",
    reason: `${m - 1} is below minimum ${m}`,
  });

  return { mutants, skipped };
}

function maximumMutator(schema: JsonSchema, _baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  const m = schema.maximum;
  if (typeof m !== "number") {
    skipped.push({
      keyword: "maximum",
      path: "",
      reason: "schema has no maximum keyword to negate",
    });
    return { mutants, skipped };
  }

  mutants.push({
    value: m + 1,
    keyword: "maximum",
    path: "",
    reason: `${m + 1} is above maximum ${m}`,
  });

  return { mutants, skipped };
}

function exclusiveMinimumMutator(schema: JsonSchema, _baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  const m = schema.exclusiveMinimum;
  if (typeof m !== "number") {
    skipped.push({
      keyword: "exclusiveMinimum",
      path: "",
      reason: "schema has no exclusiveMinimum keyword to negate",
    });
    return { mutants, skipped };
  }

  mutants.push({
    value: m,
    keyword: "exclusiveMinimum",
    path: "",
    reason: `the bound ${m} itself is excluded by exclusiveMinimum`,
  });

  return { mutants, skipped };
}

function exclusiveMaximumMutator(schema: JsonSchema, _baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  const m = schema.exclusiveMaximum;
  if (typeof m !== "number") {
    skipped.push({
      keyword: "exclusiveMaximum",
      path: "",
      reason: "schema has no exclusiveMaximum keyword to negate",
    });
    return { mutants, skipped };
  }

  mutants.push({
    value: m,
    keyword: "exclusiveMaximum",
    path: "",
    reason: `the bound ${m} itself is excluded by exclusiveMaximum`,
  });

  return { mutants, skipped };
}

function multipleOfMutator(schema: JsonSchema, baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  const k = schema.multipleOf;
  if (typeof k !== "number") {
    skipped.push({
      keyword: "multipleOf",
      path: "",
      reason: "schema has no multipleOf keyword to negate",
    });
    return { mutants, skipped };
  }

  if (k <= 0) {
    skipped.push({
      keyword: "multipleOf",
      path: "",
      reason: `multipleOf ${k} is not a positive number`,
    });
    return { mutants, skipped };
  }

  if (typeof baseline !== "number" || !Number.isFinite(baseline)) {
    skipped.push({
      keyword: "multipleOf",
      path: "",
      reason: "baseline is not a finite number, so no midpoint mutant can be built",
    });
    return { mutants, skipped };
  }

  const candidate = baseline + k / 2;
  if (candidate === baseline) {
    skipped.push({
      keyword: "multipleOf",
      path: "",
      reason: `baseline ${baseline} + multipleOf ${k}/2 is not representable as a distinct number, so no counterexample can be built by this method`,
    });
    return { mutants, skipped };
  }

  mutants.push({
    value: candidate,
    keyword: "multipleOf",
    path: "",
    reason: `${baseline} + ${k}/2 = ${candidate} is not a multiple of ${k}`,
  });

  return { mutants, skipped };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function minItemsMutator(schema: JsonSchema, baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  const n = schema.minItems;
  if (typeof n !== "number") {
    skipped.push({
      keyword: "minItems",
      path: "",
      reason: "schema has no minItems keyword to negate",
    });
    return { mutants, skipped };
  }

  if (!Array.isArray(baseline)) {
    skipped.push({
      keyword: "minItems",
      path: "",
      reason: "baseline is not a JSON array, so no element can be removed",
    });
    return { mutants, skipped };
  }

  if (n <= 0) {
    skipped.push({
      keyword: "minItems",
      path: "",
      reason: `minItems ${n} has no shorter non-negative length to truncate to`,
    });
    return { mutants, skipped };
  }

  const mutated = baseline.slice(0, n - 1);
  mutants.push({
    value: mutated,
    keyword: "minItems",
    path: "",
    reason: `truncated to length ${n - 1}, below minItems ${n}`,
  });

  return { mutants, skipped };
}

function maxItemsMutator(schema: JsonSchema, baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  const n = schema.maxItems;
  if (typeof n !== "number") {
    skipped.push({
      keyword: "maxItems",
      path: "",
      reason: "schema has no maxItems keyword to negate",
    });
    return { mutants, skipped };
  }

  if (!Array.isArray(baseline)) {
    skipped.push({
      keyword: "maxItems",
      path: "",
      reason: "baseline is not a JSON array, so no element can be appended",
    });
    return { mutants, skipped };
  }

  if (!Number.isInteger(n) || n < 0) {
    skipped.push({
      keyword: "maxItems",
      path: "",
      reason: `maxItems ${n} is not a non-negative integer`,
    });
    return { mutants, skipped };
  }

  // Extend with NEW unique values rather than duplicating an existing one:
  // measured against a schema that also sets uniqueItems: true, duplicating
  // the last element is blamed ["maxItems", "uniqueItems"] — a confounded
  // mutant. New values are blamed ["maxItems"] alone.
  const numeric = baseline.every((v) => typeof v === "number");
  const mutated: unknown[] = [...baseline];
  while (mutated.length <= n) {
    if (numeric) {
      let candidate = mutated.length;
      while (mutated.includes(candidate)) candidate++;
      mutated.push(candidate);
    } else {
      mutated.push({ "schemafuzz-extra": mutated.length });
    }
  }

  mutants.push({
    value: mutated,
    keyword: "maxItems",
    path: "",
    reason: `extended to length ${mutated.length} with new unique values, above maxItems ${n}`,
  });

  return { mutants, skipped };
}

function uniqueItemsMutator(schema: JsonSchema, baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  if (schema.uniqueItems !== true) {
    skipped.push({
      keyword: "uniqueItems",
      path: "",
      reason:
        schema.uniqueItems === false
          ? "uniqueItems is false, so duplicates are not forbidden"
          : "schema has no uniqueItems keyword to negate",
    });
    return { mutants, skipped };
  }

  if (!Array.isArray(baseline)) {
    skipped.push({
      keyword: "uniqueItems",
      path: "",
      reason: "baseline is not a JSON array",
    });
    return { mutants, skipped };
  }

  if (baseline.length === 0) {
    skipped.push({
      keyword: "uniqueItems",
      path: "",
      reason: "baseline is empty, so there is no element to duplicate",
    });
    return { mutants, skipped };
  }

  const mutated = [...baseline, baseline[0]];
  mutants.push({
    value: mutated,
    keyword: "uniqueItems",
    path: "",
    reason: "appended a duplicate of the first element",
  });

  return { mutants, skipped };
}

function additionalPropertiesMutator(schema: JsonSchema, baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  if (schema.additionalProperties !== false) {
    skipped.push({
      keyword: "additionalProperties",
      path: "",
      reason:
        schema.additionalProperties === undefined
          ? "schema has no additionalProperties keyword to negate"
          : "additionalProperties is not false, so extra keys are not forbidden",
    });
    return { mutants, skipped };
  }

  if (!isPlainObject(baseline)) {
    skipped.push({
      keyword: "additionalProperties",
      path: "",
      reason: "baseline is not a JSON object",
    });
    return { mutants, skipped };
  }

  const mutated = { ...baseline, "schemafuzz-extra": true };
  mutants.push({
    value: mutated,
    keyword: "additionalProperties",
    path: "",
    reason: 'added key "schemafuzz-extra", forbidden by additionalProperties: false',
  });

  return { mutants, skipped };
}

function minPropertiesMutator(schema: JsonSchema, baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  const n = schema.minProperties;
  if (typeof n !== "number") {
    skipped.push({
      keyword: "minProperties",
      path: "",
      reason: "schema has no minProperties keyword to negate",
    });
    return { mutants, skipped };
  }

  if (!isPlainObject(baseline)) {
    skipped.push({
      keyword: "minProperties",
      path: "",
      reason: "baseline is not a JSON object",
    });
    return { mutants, skipped };
  }

  const required = new Set(schema.required ?? []);
  const droppable = Object.keys(baseline).find((k) => !required.has(k));

  if (droppable === undefined) {
    skipped.push({
      keyword: "minProperties",
      path: "",
      reason:
        "every present key is required, so no non-required key can be dropped without confounding with required",
    });
    return { mutants, skipped };
  }

  const mutated = { ...baseline };
  delete mutated[droppable];

  if (Object.keys(mutated).length >= n) {
    skipped.push({
      keyword: "minProperties",
      path: "",
      reason: `dropping non-required key "${droppable}" still leaves ${Object.keys(mutated).length} properties, at or above minProperties ${n}`,
    });
    return { mutants, skipped };
  }

  mutants.push({
    value: mutated,
    keyword: "minProperties",
    path: "",
    reason: `dropped non-required key "${droppable}", leaving ${Object.keys(mutated).length} properties, below minProperties ${n}`,
  });

  return { mutants, skipped };
}

function maxPropertiesMutator(schema: JsonSchema, baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  const n = schema.maxProperties;
  if (typeof n !== "number") {
    skipped.push({
      keyword: "maxProperties",
      path: "",
      reason: "schema has no maxProperties keyword to negate",
    });
    return { mutants, skipped };
  }

  if (!isPlainObject(baseline)) {
    skipped.push({
      keyword: "maxProperties",
      path: "",
      reason: "baseline is not a JSON object",
    });
    return { mutants, skipped };
  }

  if (!Number.isInteger(n) || n < 0) {
    skipped.push({
      keyword: "maxProperties",
      path: "",
      reason: `maxProperties ${n} is not a non-negative integer`,
    });
    return { mutants, skipped };
  }

  const mutated: Record<string, unknown> = { ...baseline };
  let i = 0;
  while (Object.keys(mutated).length <= n) {
    let key = `schemafuzz-extra-${i}`;
    while (key in mutated) {
      i++;
      key = `schemafuzz-extra-${i}`;
    }
    mutated[key] = true;
    i++;
  }

  mutants.push({
    value: mutated,
    keyword: "maxProperties",
    path: "",
    reason: `added keys until ${Object.keys(mutated).length} properties, above maxProperties ${n}`,
  });

  return { mutants, skipped };
}

/** Ordered candidate pool for negating `propertyNames.pattern`. */
const PROPERTY_NAME_CANDIDATES = ["SCHEMAFUZZ-1", "!", "\u0000"];

function propertyNamesMutator(schema: JsonSchema, baseline: unknown): MutateResult {
  const mutants: Mutant[] = [];
  const skipped: Skipped[] = [];

  const pn = schema.propertyNames;
  if (!isPlainObject(pn) || typeof pn.pattern !== "string") {
    skipped.push({
      keyword: "propertyNames",
      path: "",
      reason: "schema has no propertyNames.pattern keyword to negate",
    });
    return { mutants, skipped };
  }

  if (!isPlainObject(baseline)) {
    skipped.push({
      keyword: "propertyNames",
      path: "",
      reason: "baseline is not a JSON object",
    });
    return { mutants, skipped };
  }

  let re: RegExp;
  try {
    re = new RegExp(pn.pattern);
  } catch {
    skipped.push({
      keyword: "propertyNames",
      path: "",
      reason: `propertyNames.pattern "${pn.pattern}" is not a valid RegExp`,
    });
    return { mutants, skipped };
  }

  const candidate = PROPERTY_NAME_CANDIDATES.find(
    (c) => !re.test(c) && !(c in baseline)
  );

  if (candidate === undefined) {
    skipped.push({
      keyword: "propertyNames",
      path: "",
      reason: `propertyNames.pattern "${pn.pattern}" matches every candidate in the negation pool`,
    });
    return { mutants, skipped };
  }

  const mutated = { ...baseline, [candidate]: true };
  mutants.push({
    value: mutated,
    keyword: "propertyNames",
    path: `/${escapeToken(candidate)}`,
    reason: `added key "${candidate}", whose name does not match propertyNames.pattern "${pn.pattern}"`,
  });

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
const MUTATORS: Array<{
  keywords: string[];
  run: (schema: JsonSchema, baseline: unknown) => MutateResult;
}> = [
  { keywords: ["type"], run: typeMutator },
  { keywords: ["required"], run: requiredMutator },
  { keywords: ["minLength"], run: minLengthMutator },
  { keywords: ["maxLength"], run: maxLengthMutator },
  { keywords: ["pattern"], run: patternMutator },
  { keywords: ["enum", "const"], run: enumConstMutator },
  { keywords: ["minimum"], run: minimumMutator },
  { keywords: ["maximum"], run: maximumMutator },
  { keywords: ["exclusiveMinimum"], run: exclusiveMinimumMutator },
  { keywords: ["exclusiveMaximum"], run: exclusiveMaximumMutator },
  { keywords: ["multipleOf"], run: multipleOfMutator },
  { keywords: ["minItems"], run: minItemsMutator },
  { keywords: ["maxItems"], run: maxItemsMutator },
  { keywords: ["uniqueItems"], run: uniqueItemsMutator },
  { keywords: ["additionalProperties"], run: additionalPropertiesMutator },
  { keywords: ["minProperties"], run: minPropertiesMutator },
  { keywords: ["maxProperties"], run: maxPropertiesMutator },
  { keywords: ["propertyNames"], run: propertyNamesMutator },
];

/** Every keyword any registered mutator can emit. The fixture set must exercise all of them. */
export const MUTATOR_KEYWORDS: string[] = MUTATORS.flatMap((m) => m.keywords);

/** Run only the registered keyword mutators on this exact schema/baseline pair — no recursion. */
function mutateFlat(schema: JsonSchema, baseline: unknown): MutateResult {
  const results = MUTATORS.map((m) => m.run(schema, baseline));
  return {
    mutants: results.flatMap((r) => r.mutants),
    skipped: results.flatMap((r) => r.skipped),
  };
}

export function mutate(schema: JsonSchema, baseline: unknown): MutateResult {
  const flat = mutateFlat(schema, baseline);
  const mutants: Mutant[] = [...flat.mutants];
  const nestedMutants: Mutant[] = [];
  const nestedSkipped: Skipped[] = [];

  // Recurse one level into `properties`: splice each nested sub-mutant back
  // into a copy of the parent baseline at the corresponding key. A nested
  // mutant's `keyword` is the nested schema's own keyword (e.g. `minLength`),
  // never `properties` itself — `properties` is a recursion site, not a
  // mutator. Skips carry the path they were computed at, so a root-level
  // skip (`path: ""`) is never confused with one found while recursing into
  // `/name`.
  if (schema.properties && isPlainObject(baseline)) {
    for (const [key, subschema] of Object.entries(schema.properties)) {
      if (!(key in baseline)) continue;
      const keyToken = `/${escapeToken(key)}`;
      const sub = mutateFlat(subschema, baseline[key]);
      for (const m of sub.mutants) {
        nestedMutants.push({
          value: { ...baseline, [key]: m.value },
          keyword: m.keyword,
          path: keyToken + m.path,
          reason: m.reason,
        });
      }
      for (const s of sub.skipped) {
        nestedSkipped.push({ keyword: s.keyword, path: keyToken + s.path, reason: s.reason });
      }
    }
  }

  // Recurse one level into `items` (object form only — a single subschema
  // applied to every element; tuple form, an array of subschemas, is out of
  // scope). `items` is measured to be a recursion site, not a mutator: its
  // spliced mutant is blamed on the nested schema's own keyword (e.g.
  // `type`), never on `items`.
  if (schema.items && !Array.isArray(schema.items) && Array.isArray(baseline)) {
    const itemSchema = schema.items;
    baseline.forEach((item, index) => {
      const idxToken = `/${index}`;
      const sub = mutateFlat(itemSchema, item);
      for (const m of sub.mutants) {
        const spliced = [...baseline];
        spliced[index] = m.value;
        nestedMutants.push({ value: spliced, keyword: m.keyword, path: idxToken + m.path, reason: m.reason });
      }
      for (const s of sub.skipped) {
        nestedSkipped.push({ keyword: s.keyword, path: idxToken + s.path, reason: s.reason });
      }
    });
  }

  // A root-level skip claiming "schema has no <keyword> keyword to negate"
  // is true of the root and false of the schema once recursion finds that
  // same keyword one level down (as either a nested mutant or a nested skip)
  // — measured on the canonical nested-minLength case, where the root skip
  // read like a complete "nothing to negate" about a schema that plainly had
  // a minLength to negate at /name. Drop it rather than let it lie.
  const nestedKeywords = new Set([...nestedMutants, ...nestedSkipped].map((e) => e.keyword));
  const rootSkipped = flat.skipped.filter(
    (s) => !(s.path === "" && nestedKeywords.has(s.keyword))
  );

  mutants.push(...nestedMutants);
  const skipped = [...rootSkipped, ...nestedSkipped];

  return { mutants, skipped };
}
