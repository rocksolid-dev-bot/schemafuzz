# Changelog

All notable changes to schemafuzz are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- The README's usage block installed from a registry the package is not published to; it now
  installs the tarball the gate itself packs.
- The release gate's final step now prints its own exit status instead of a bare header.

## [0.1.0] — 2026-09-28

### Added

- The package now exposes `mutate` and `MUTATOR_KEYWORDS` as an ESM entry point
  (`"exports"`/`"main"`/`"types"` in `package.json`, `"declaration": true` in `tsconfig.json`)
  with generated type declarations, and ships only `dist/` (`"files"` in `package.json`) — no
  `test/`, `media/`, or `tsconfig.json` in the published tarball.
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
- Recursion into `allOf`: each branch is a conjunct on the same instance, not a level of
  nesting, so each branch is recursed with `mutate` (not `mutateFlat`) and its mutants are
  kept at the value and path `mutate` already computed for that branch — a root-level branch
  mutant keeps `path: ""`, a branch that nests into `properties`/`items` keeps that nested
  path. `allOf` registers no mutator of its own (`MUTATOR_KEYWORDS` stays 19). Branch skips
  are deliberately not folded into the reported `skipped` list: a branch skip carries
  `path: ""`, indistinguishable from a root skip, and folding it in would rebuild the
  lying-skip confusion the root-skip fix above removed.
- `type` mutator: when the allowed set contains `integer` and not `number` and the baseline is a
  finite integer, a second `type` mutant is emitted alongside the existing type-substitution
  mutant: `baseline + 0.5`. `integer` is a refinement of `number`, not a disjoint JSON type, so
  the substitution mutant (the first allowed JSON type not in `allowed`) never produces a
  non-integer counterexample on its own; a validator that treats `integer` as `number` passed
  every mutant this mutator emitted before this change. No new mutator is registered
  (`MUTATOR_KEYWORDS` stays 19) — the offset lives inside the existing `type` mutator.

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

### Notes

- `test/vendor/` vendors a slice of `json-schema-org/JSON-Schema-Test-Suite`
  (MIT, Copyright (c) 2012 Julian Berman), pinned at commit
  `5b0ee1613e45fcc2bddac00e07c19cd49b00d8a8`; `test/vendor/LICENSE` carries that licence and
  stays in the repository even though `dist`-only packaging drops `test/` from the tarball.
