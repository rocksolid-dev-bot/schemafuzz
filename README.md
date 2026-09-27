# schemafuzz

From a JSON Schema, generate the payloads that must be rejected — each one labelled with the keyword it violates — so a test suite can prove its validation actually enforces the schema.

Status: pre-release (`package.json` version `0.0.0`, nothing tagged), with 19
registered mutator keywords and one level of recursion into `properties`,
`items`, and `allOf`, checked against a vendored slice of the official
`json-schema-org/JSON-Schema-Test-Suite` as a ground-truth harness. The
library reports schemas that have no counterexample (e.g. `{}`) via a
non-empty `skipped` list, rather than throwing.

## Known limitations

`mutants.length` over-counts distinct claims when two mutators land on the same keyword by
different routes. `{type:"string",minLength:3,allOf:[{minLength:5}]}` with baseline `"abcdef"`
yields 3 mutants: `type@""` `3.14`, and `minLength@""` twice — `"aa"` (below the root's `3`) and
`"aaaa"` (below the branch's `5`). Both are sound counterexamples and both are correctly blamed
on `minLength`, so a consumer deduping mutants by `keyword` + `path` silently loses one. This is
a report-quality defect, not a correctness one: the limitation is the duplicate *claim*, not a
wrong one.
