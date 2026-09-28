# schemafuzz

From a JSON Schema, generate the payloads that must be rejected — each one labelled with the keyword it violates — so a test suite can prove its validation actually enforces the schema.

Status: `v0.1.0`, installed and verified as a published artifact — `package.json`
declares `"main"`/`"exports"`/`"types"`/`"files"`, `npm pack` ships only `dist/`
plus `README.md`, `CHANGELOG.md`, and `LICENSE`, and `scripts/prepush.sh` installs
the packed tarball into a throwaway project outside the repo and imports it before
any push. 19 registered mutator keywords, one level of recursion into `properties`,
`items`, and `allOf`, checked against a vendored slice of the official
`json-schema-org/JSON-Schema-Test-Suite` as a ground-truth harness. The
library reports schemas that have no counterexample (e.g. `{}`) via a
non-empty `skipped` list, rather than throwing.

## Usage

Install the published package, then import it by name — this is the exact usage block
from `scripts/prepush.sh`'s step 9, run against the packed `v0.1.0` tarball installed
into a throwaway project outside the repo:

```
$ npm i schemafuzz
$ node --input-type=module -e '
import { mutate, MUTATOR_KEYWORDS } from "schemafuzz";
console.log(MUTATOR_KEYWORDS.length);
console.log(mutate({type:"string",minLength:3}, "abcdef").mutants.length);
'
19
2
```

## Known limitations

`mutants.length` over-counts distinct claims when two mutators land on the same keyword by
different routes. `{type:"string",minLength:3,allOf:[{minLength:5}]}` with baseline `"abcdef"`
yields 3 mutants: `type@""` `3.14`, and `minLength@""` twice — `"aa"` (below the root's `3`) and
`"aaaa"` (below the branch's `5`). Both are sound counterexamples and both are correctly blamed
on `minLength`, so a consumer deduping mutants by `keyword` + `path` silently loses one. This is
a report-quality defect, not a correctness one: the limitation is the duplicate *claim*, not a
wrong one.
