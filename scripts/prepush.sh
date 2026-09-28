#!/bin/sh
# The gate that consumes the package the way a user does: not testing harder, installing it.
# set -e deliberately NOT used: each step prints its own exit code and the script accumulates
# a status, so one failure does not hide the steps after it.
status=0

echo "--- 1: node -v ---"
node -v
echo "exit=$?"

echo "--- 2: npm ci ---"
npm ci
rc=$?; echo "exit=$rc"; [ "$rc" -ne 0 ] && status=1

echo "--- 3: npx tsc --noEmit ---"
npx tsc --noEmit
rc=$?; echo "exit=$rc"; [ "$rc" -ne 0 ] && status=1

echo "--- 4: npm run build ---"
npm run build
rc=$?; echo "exit=$rc"; [ "$rc" -ne 0 ] && status=1

echo "--- 5: npm test ---"
npm test
rc=$?; echo "exit=$rc"; [ "$rc" -ne 0 ] && status=1

echo "--- 6: sh scripts/invariants.sh ---"
sh scripts/invariants.sh
rc=$?; echo "exit=$rc"; [ "$rc" -ne 0 ] && status=1

echo "--- 7: npm pack ---"
tarball=$(npm pack 2>/dev/null | tail -n1)
rc=$?; echo "tarball=$tarball"; echo "exit=$rc"; [ "$rc" -ne 0 ] && status=1

echo "--- 8: install tarball into a throwaway consumer outside the repo ---"
abstarball="$(pwd)/$tarball"
rm -rf /tmp/sf-consumer
mkdir -p /tmp/sf-consumer && cd /tmp/sf-consumer && npm init -y >/dev/null 2>&1 && npm i "$abstarball"
rc=$?; echo "exit=$rc"; [ "$rc" -ne 0 ] && status=1

echo "--- 9: import the installed package and probe it ---"
cd /tmp/sf-consumer
node --input-type=module -e '
import { mutate, MUTATOR_KEYWORDS } from "schemafuzz";
console.log(MUTATOR_KEYWORDS.length);
console.log(mutate({type:"string",minLength:3}, "abcdef").mutants.length);
'
rc=$?; echo "exit=$rc"; [ "$rc" -ne 0 ] && status=1

cd - >/dev/null
rm -f "$tarball"

echo "--- 10: overall status ---"
exit $status
