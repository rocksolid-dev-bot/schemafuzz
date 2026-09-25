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

### Changed

- `tsconfig.json` enables `noUnusedLocals` and `noUnusedParameters`, so the type-checker enforces
  the consumer rule across `src/`.

### Removed

- The orphaned `jsonTypeOf` helper and the comment that cited it.
