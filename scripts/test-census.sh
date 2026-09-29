#!/bin/sh
# Reconciles vitest's per-file test counts against its own reported total. The defect this
# guards is an absence — a capture that looks finished but never carries the breakdown — so
# the pass condition is "the components exist and sum to the total", not just "a number appears".
# Usage: sh scripts/test-census.sh <path-to-captured-test-output>

file="$1"

if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "FAIL: no such captured test output file: '$file'"
  exit 1
fi

awk '
{
  if (match($0, /✓[[:space:]]+[^[:space:]]+[[:space:]]+\([0-9]+ tests/)) {
    line = $0
    match(line, /✓[[:space:]]+[^[:space:]]+/)
    ftok = substr(line, RSTART, RLENGTH)
    sub(/^✓[[:space:]]+/, "", ftok)
    match(line, /\([0-9]+ tests/)
    ctok = substr(line, RSTART + 1, RLENGTH - 1)
    sub(/ tests$/, "", ctok)
    count = ctok + 0
    printf "component: %s = %d\n", ftok, count
    sum += count
    k++
  }
  if ($0 ~ /^[[:space:]]*Tests[[:space:]]/) {
    rest = $0
    last = -1
    while (match(rest, /\([0-9]+\)/)) {
      tok = substr(rest, RSTART + 1, RLENGTH - 2)
      last = tok + 0
      rest = substr(rest, RSTART + RLENGTH)
    }
    if (last >= 0) { reported = last; have_total = 1 }
  }
}
END {
  if (k == 0) {
    print "FAIL: no per-file test counts found"
    exit 1
  }
  printf "components: %d file(s), sum = %d\n", k, sum
  if (!have_total) {
    print "FAIL: no reported total found"
    exit 1
  }
  printf "reported total: %d\n", reported
  if (sum != reported) {
    printf "FAIL: components sum %d != reported total %d\n", sum, reported
    exit 1
  }
  print "ok: test total reconciles into its components"
  exit 0
}
' "$file"
