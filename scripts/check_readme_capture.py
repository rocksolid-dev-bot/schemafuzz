#!/usr/bin/env python3
"""Extract every fenced code block in README.md that shows a real captured
command run (its first line is a `$ ` prompt) and assert every non-empty
line in that block appears verbatim in the capture file. Blocks that are
not a captured run are deliberately not checked here - they were never
claimed to be pasted output.

The defect this guard catches: a README usage block whose commands were
reconstructed (retyped, predicted, or hand-edited) rather than pasted
byte-for-byte from a real run of the gate. A block that merely looks like
a transcript can drift silently from what the gate actually does; this
script makes that drift a red exit code instead of a readme review note.

Ported from archive/cronscape/code/scripts/check_readme_capture.py (this
account's own artifact, third repo it has lived in). Two adaptations, both
measured against this README rather than copied: the capture path is now
`sys.argv[1]`, defaulting to this cycle's capture file, because cronscape
hard-coded its own cycle's filename and that makes the port necessary
every time; and MIN_CAPTURED_BLOCKS is lowered to 1, because this README
has exactly one captured-run block and cronscape's floor of 2 fails
against a correct tree here. A floor is per-README, not a constant to
carry forward unmeasured.

A prompt-keyed extractor that finds zero captured blocks, or a block with
only one or two throwaway lines, would exit 0 having checked almost
nothing - the day-3/day-4 defect shape, a criterion that cannot fail. So
this script also fails loudly below a minimum block count and a minimum
checked-line count. MIN_CHECKED_LINES is a chosen floor, not a
measurement: do not raise it to whatever a given run happens to print.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "README.md"
CAPTURE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "media" / "2026-09-28-day11.txt"
MIN_CAPTURED_BLOCKS = 1
MIN_CHECKED_LINES = 6

readme_text = README.read_text()
capture_lines = set(CAPTURE.read_text().splitlines())

fence_re = re.compile(r"```(?:\w*)\n(.*?)```", re.DOTALL)
blocks = fence_re.findall(readme_text)

captured_blocks = [b for b in blocks if b.splitlines() and b.splitlines()[0].startswith("$ ")]

unmatched = []
checked = 0
for block in captured_blocks:
    for line in block.splitlines():
        if line.strip() == "":
            continue
        checked += 1
        if line not in capture_lines:
            unmatched.append(line)

print(f"fenced blocks total: {len(blocks)}")
print(f"captured-run blocks checked: {len(captured_blocks)}")
print(f"lines checked: {checked}")
print(f"minimum checked lines required: {MIN_CHECKED_LINES}")
print(f"unmatched: {len(unmatched)}")
for line in unmatched:
    print(f"  MISS: {line!r}")

if len(captured_blocks) < MIN_CAPTURED_BLOCKS:
    print(f"FAIL: only {len(captured_blocks)} captured-run block(s) found, need >= {MIN_CAPTURED_BLOCKS}")
    sys.exit(1)

if checked < MIN_CHECKED_LINES:
    print(f"FAIL: only {checked} line(s) checked, need >= {MIN_CHECKED_LINES}")
    sys.exit(1)

sys.exit(1 if unmatched else 0)
