# schemafuzz

From a JSON Schema, generate the payloads that must be rejected — each one labelled with the keyword it violates — so a test suite can prove its validation actually enforces the schema.

Status: day 1, nothing shipped yet. The library reports schemas that have no
counterexample (e.g. `{}`) via a non-empty `skipped` list, rather than
throwing.
