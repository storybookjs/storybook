#!/usr/bin/env python3
"""External package imports by directory (src files vs test-only).

  python3 feature-audit/notes/imports_by_dir.py <root> <depth>
"""
import collections
import os
import re
import subprocess
import sys

root = sys.argv[1]
depth = int(sys.argv[2])
files = subprocess.check_output(["git", "ls-files", root]).decode().split("\n")
SRC_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".mts", ".cts"}
IMP = re.compile(r"""(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s*['"]([^'"]+)['"]|(?:^|[^\w])(?:require|import)\(\s*['"]([^'"]+)['"]""")
BUILTIN = set("assert async_hooks buffer child_process cluster console constants crypto dgram dns domain events fs http http2 https inspector module net os path perf_hooks process punycode querystring readline repl stream string_decoder timers tls tty url util v8 vm wasi worker_threads zlib".split())


def pkg(s):
    if s.startswith(".") or s.startswith("/") or s.startswith("#") or s.startswith("node:"):
        return None
    if s.split("/")[0] in BUILTIN:
        return None
    if s.startswith("storybook/") or s == "storybook":
        return "storybook(internal)" if "internal" in s else "storybook(public)"
    parts = s.split("/")
    return "/".join(parts[:2]) if s.startswith("@") else parts[0]


def istest(p):
    b = os.path.basename(p)
    return bool(re.search(r"\.(test|spec|test-d)\.[cm]?[jt]sx?$", b) or "__tests__" in p or "__tests/" in p or ".stories." in b or "mockdata" in b
                or "/template/" in p or "/__mocks__/" in p or "fixtures" in p or "__testfixtures__" in p or "__mockdata__" in p)


agg = collections.defaultdict(set)
agg_test = collections.defaultdict(set)
for f in files:
    if not f or os.path.splitext(f)[1] not in SRC_EXT or not os.path.isfile(f):
        continue
    try:
        txt = open(f, encoding="utf-8", errors="ignore").read()
    except OSError:
        continue
    key = "/".join(f.split("/")[:depth])
    for m in IMP.finditer(txt):
        s = m.group(1) or m.group(2)
        p = pkg(s)
        if p:
            (agg_test if istest(f) else agg)[key].add(p)
for k in sorted(set(agg) | set(agg_test)):
    ext = sorted(x for x in agg[k] if not x.startswith("storybook("))
    print(f"{k} [{len(ext)} ext]: {', '.join(ext)}")
    t = sorted(x for x in agg_test[k] - agg[k] if not x.startswith("storybook("))
    if t:
        print(f"    test-only: {', '.join(t)}")
