#!/usr/bin/env python3
"""Line counts by directory, split into src / test / stories / template / d.ts.

  python3 feature-audit/notes/loc_by_dir.py <root> <depth>
"""
import collections
import os
import re
import subprocess
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "code"
depth = int(sys.argv[2]) if len(sys.argv) > 2 else 2
files = subprocess.check_output(["git", "ls-files", root]).decode().split("\n")
SRC_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".mts", ".cts"}


def cat(p):
    base = os.path.basename(p)
    ext = os.path.splitext(p)[1]
    if ext not in SRC_EXT:
        return None
    if "/template/" in p or "/__mocks__/" in p or "/__mocks-ng-workspace/" in p:
        return "template"
    if re.search(r"\.(test|spec)\.[cm]?[jt]sx?$", base) or "/__tests__/" in p or "/__tests/" in p:
        return "test"
    if ".stories." in base:
        return "stories"
    if base.endswith(".d.ts"):
        return "dts"
    return "src"


agg = collections.defaultdict(collections.Counter)
for f in files:
    if not f or not os.path.isfile(f):
        continue
    c = cat(f)
    if not c:
        continue
    key = "/".join(f.split("/")[:depth])
    try:
        n = sum(1 for _ in open(f, "rb"))
    except OSError:
        n = 0
    agg[key][c] += n
    agg[key]["files_" + c] += 1
print(f"{'dir':60} {'src':>8} {'test':>8} {'stories':>8} {'tmpl':>8} {'dts':>6} {'files':>6}")
tot = collections.Counter()
for k in sorted(agg, key=lambda k: -agg[k]["src"]):
    a = agg[k]
    tot.update(a)
    print(f"{k:60} {a['src']:8} {a['test']:8} {a['stories']:8} {a['template']:8} {a['dts']:6} {a['files_src']:6}")
print(f"{'TOTAL':60} {tot['src']:8} {tot['test']:8} {tot['stories']:8} {tot['template']:8} {tot['dts']:6} {tot['files_src']:6}")
