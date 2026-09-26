# Changelog

All notable changes to schemafuzz are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Oracle harness: `mutate(schema, baseline)` returns counterexample `mutants` plus `skipped`
  negations, and never throws. `ajv` is a devDependency used only by the tests, as an
  independent-method oracle; the library imports it nowhere.
- `type` and `required` mutators.
- `minLength`, `maxLength`, `pattern`, `enum`, `const` mutators, backed by a `MUTATORS` registry
  (`MUTATOR_KEYWORDS`) so every registered mutator is exercised by at least one fixture, checked
  by a per-keyword coverage test.
- `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf` mutators.
- `minItems`, `maxItems`, `uniqueItems`, `additionalProperties`, `minProperties`,
  `maxProperties`, `propertyNames` mutators (structural keywords), with fixtures designed to
  avoid the confounds ajv's blame list can expose: `maxItems` extends with new unique values
  rather than duplicating (avoids a false `uniqueItems` co-blame), and `minProperties` drops a
  non-required key (avoids a false `required` co-blame).
- Vendored ground-truth harness (`test/vendor/`, `test/vendor.test.ts`): 19 keyword files plus
  `LICENSE` from `json-schema-org/JSON-Schema-Test-Suite` (MIT, Copyright (c) 2012 Julian Berman),
  pinned at commit `5b0ee1613e45fcc2bddac00e07c19cd49b00d8a8`, draft2020-12. Asserts 0 mutants
  accepted by ajv and 0 blame mismatches across every usable group, with a per-file usable >= 1
  floor so an empty harness cannot pass. Pins no total mutant/group count.
- Recursion, one level, into `properties` (each value) and `items` (object form): a nested
  sub-mutant is spliced back into a copy of the parent baseline at the corresponding key
  (`/name`) or index (`/0`), keeping the nested schema's own keyword as the mutant's `keyword`.
  `items` is a recursion site, not a mutator. Skips now carry the path they were computed at
  (measured non-empty paths: `/0`, `/1`, `/2`, `/a`, `/name`), so a root-level "no `minLength`
  keyword to negate" skip is dropped once recursion finds `minLength` genuinely present one
  level down — that skip was true of the root and false of the schema.

### Fixed

- Root-skip filter no longer deletes true claims. It built its "keyword found one level
  down" set from both nested mutants and nested skips; a nested skip is itself a
  "not present" claim, and recursion emits one per unregistered keyword, so the set was
  every keyword and every root skip was dropped, including the true ones. The set is now
  built from nested mutants alone — the direction that survives is a root skip whose
  keyword appears nowhere in the schema, which now correctly survives recursion instead
  of being deleted alongside the false ones.
- `multipleOf` no longer emits a value ajv accepts. Where `baseline + multipleOf/2` is swallowed
  by float precision — `12391239123 + 1e-8/2 === 12391239123` — the mutator now reports a
  `skipped` entry instead of a counterexample that is not one. Found by running `mutate()` over
  `json-schema-org/JSON-Schema-Test-Suite`, not by reading the code.

### Changed

- `tsconfig.json` enables `noUnusedLocals` and `noUnusedParameters`, so the type-checker enforces
  the consumer rule across `src/`.

### Removed

- The orphaned `jsonTypeOf` helper and the comment that cited it.
