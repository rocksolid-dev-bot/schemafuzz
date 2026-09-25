#!/bin/sh
# Invariants that must hold at every commit. Invoked BY PATH from the close-out capture,
# so the bytes recorded in the capture are the bytes that ran. Exit 0 = all invariants hold.
status=0

echo "--- no throws in src/ (errors are values) ---"
if grep -rn "throw " src/; then echo "FAIL: src/ throws"; status=1; else echo "ok: no throws"; fi

echo "--- ajv is never imported by the shipped library ---"
if grep -rn "from ['\"]ajv" src/; then echo "FAIL: src/ imports ajv"; status=1; else echo "ok: no ajv import"; fi

echo "--- every registered mutator keyword is exercised by a fixture ---"
echo "(asserted by the coverage tests in test/oracle.test.ts)"

exit $status
