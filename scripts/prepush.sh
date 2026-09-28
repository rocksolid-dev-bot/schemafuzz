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
srcdir="$(pwd)"
abstarball="$(pwd)/$tarball"
rm -rf /tmp/sf-consumer
mkdir -p /tmp/sf-consumer && cd /tmp/sf-consumer && npm init -y >/dev/null 2>&1
cp "$abstarball" "./$tarball"
echo "\$ npm i ./$tarball"
npm i "./$tarball"
rc=$?; echo "exit=$rc"; [ "$rc" -ne 0 ] && status=1

echo "--- 9: import the installed package and probe it ---"
cd /tmp/sf-consumer
echo "\$ node --input-type=module -e '"
cat "$srcdir/scripts/usage-probe.mjs"
echo "'"
node --input-type=module -e "$(cat "$srcdir/scripts/usage-probe.mjs")"
rc=$?; echo "exit=$rc"; [ "$rc" -ne 0 ] && status=1

cd - >/dev/null
rm -f "$tarball"

echo "--- 10: manifest falsification (main+exports stripped, /tmp/sf-consumer only) ---"
manifest="/tmp/sf-consumer/node_modules/schemafuzz/package.json"
backup="/tmp/sf-consumer-package.json.bak"
cp "$manifest" "$backup"
node -e '
const fs = require("fs");
const p = "/tmp/sf-consumer/node_modules/schemafuzz/package.json";
const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
delete pkg.main;
delete pkg.exports;
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
console.log(JSON.stringify(pkg, null, 2));
'
echo "\$ node --input-type=module -e '"
cat "$srcdir/scripts/usage-probe.mjs"
echo "'"
node --input-type=module -e "$(cat "$srcdir/scripts/usage-probe.mjs")"
rc=$?; echo "exit=$rc"; [ "$rc" -eq 0 ] && status=1
cp "$backup" "$manifest"
echo "\$ node --input-type=module -e '"
cat "$srcdir/scripts/usage-probe.mjs"
echo "'"
node --input-type=module -e "$(cat "$srcdir/scripts/usage-probe.mjs")"
rc=$?; echo "exit=$rc"; [ "$rc" -ne 0 ] && status=1

echo "--- 11: overall status ---"
echo "overall exit=$status"
exit $status
