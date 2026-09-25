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

### Changed

- `tsconfig.json` enables `noUnusedLocals` and `noUnusedParameters`, so the type-checker enforces
  the consumer rule across `src/`.

### Removed

- The orphaned `jsonTypeOf` helper and the comment that cited it.
