#!/bin/sh
# The README-capture guard's red direction lives here as a run, not a sentence in an
# acceptance list — a criterion reported instead of executed can go stale silently.
# Usage: sh scripts/falsify.sh <path-to-current-capture>
status=0
capture="$1"
root="$(cd "$(dirname "$0")/.." && pwd)"

echo "--- falsify 1: red direction (day-10 capture predates the echoing gate) ---"
python3 "$root/scripts/check_readme_capture.py" "$root/media/2026-09-28-day10.txt"
rc=$?; echo "exit=$rc"; [ "$rc" -eq 0 ] && status=1

echo "--- falsify 2: green direction (current capture) ---"
python3 "$root/scripts/check_readme_capture.py" "$capture"
rc=$?; echo "exit=$rc"; [ "$rc" -ne 0 ] && status=1

echo "--- falsify 3: census red on a component mismatch ---"
sh "$root/scripts/test-census.sh" "$root/scripts/census-fixtures/mismatch.txt"
rc=$?; echo "exit=$rc"; [ "$rc" -eq 0 ] && status=1

echo "--- falsify 4: census red when the components are absent ---"
sh "$root/scripts/test-census.sh" "$root/scripts/census-fixtures/absent.txt"
rc=$?; echo "exit=$rc"; [ "$rc" -eq 0 ] && status=1

echo "falsify overall exit=$status"
exit $status
