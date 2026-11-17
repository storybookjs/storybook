#!/usr/bin/env python3
"""Non-merge commits per area over a period, dropping bulk commits.

  python3 feature-audit/notes/churn_by_area.py <since> <max-files-per-commit>
"""
import collections
import subprocess
import sys

since = sys.argv[1]
maxfiles = int(sys.argv[2]) if len(sys.argv) > 2 else 40
out = subprocess.check_output(["git", "log", "--since=" + since, "--no-merges", "--name-only", "--pretty=format:%H", "--", "code"]).decode()
per_commit = collections.defaultdict(list)
cur = None
for line in out.split("\n"):
    if not line.strip():
        continue
    if len(line) == 40 and all(c in "0123456789abcdef" for c in line):
        cur = line
        continue
    if cur:
        per_commit[cur].append(line)
commits = collections.defaultdict(set)
touches = collections.Counter()
skipped = 0
for c, files in per_commit.items():
    if len(files) > maxfiles:
        skipped += 1
        continue
    for line in files:
        if not line.startswith("code/"):
            continue
        key = "/".join(line.split("/")[:4]) if line.startswith("code/core/src/") else "/".join(line.split("/")[:3])
        commits[key].add(c)
        touches[key] += 1
print(f"# commits total={len(per_commit)} skipped(bulk>{maxfiles} files)={skipped}")
print(f"{'area':55} {'commits':>8} {'touches':>8}")
for k in sorted(commits, key=lambda k: -len(commits[k]))[:75]:
    print(f"{k:55} {len(commits[k]):8} {touches[k]:8}")
