#!/usr/bin/env python3
"""Collect merged pull requests (last N months) with their labels and changed files.

PR numbers come from merge commits reachable from `--ref` (`Merge pull request #N` subjects, plus
squash `(#N)` subjects on single-parent commits), the changed files from `git diff` against the
first parent, and labels/title from the GitHub GraphQL API in batches of 100 (`gh` must be
authenticated). Output: signals/github-merged-prs.json.

  python3 feature-audit/fetch_pr_labels.py [--since 2025-10-20] [--ref origin/next]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], cwd=HERE).decode().strip()
OUT = os.path.join(HERE, "signals", "github-merged-prs.json")

MERGE_RE = re.compile(r"^Merge pull request #(\d+)")
SQUASH_RE = re.compile(r"\(#(\d+)\)\s*$")


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT).decode(errors="replace")


def local_prs(since: str, ref: str) -> dict[int, dict]:
    """Every merged PR reachable from `ref` whose merge commit is dated on/after `since`.

    The walk deliberately avoids `git log --since`, which stops traversing at the first commit
    older than the cutoff and silently truncates long merge chains. Nested PRs (merged into a
    feature branch that later merged into `ref`) are included and deduplicated by number.
    """
    cutoff = dt.datetime.fromisoformat(since).replace(tzinfo=dt.timezone.utc)
    out = git("log", "-n", "60000", "--pretty=format:%H%x00%P%x00%cI%x00%s", ref)
    prs: dict[int, dict] = {}
    for line in out.split("\n"):
        if not line.strip():
            continue
        sha, parents, date, subject = line.split("\x00", 3)
        if dt.datetime.fromisoformat(date) < cutoff:
            continue
        parents_list = parents.split()
        m = MERGE_RE.match(subject)
        if m and len(parents_list) >= 2:
            number = int(m.group(1))
            diff_args = ("diff", "--name-only", parents_list[0], sha)
        else:
            m = SQUASH_RE.search(subject)
            if not m or len(parents_list) != 1:
                continue
            number = int(m.group(1))
            diff_args = ("diff-tree", "--no-commit-id", "--name-only", "-r", sha)
        if number in prs:
            continue
        files = git(*diff_args).split("\n")
        prs[number] = {"number": number, "merge_commit": sha, "merged_at_local": date, "subject": subject, "files": sorted({f for f in files if f})}
    return prs


def fetch_labels(numbers: list[int]) -> dict[int, dict]:
    result: dict[int, dict] = {}
    for i in range(0, len(numbers), 100):
        batch = numbers[i : i + 100]
        parts = [
            f'p{n}: pullRequest(number: {n}) {{ number title mergedAt labels(first: 30) {{ nodes {{ name }} }} author {{ login }} }}'
            for n in batch
        ]
        q = 'query { repository(owner:"storybookjs", name:"storybook") { ' + " ".join(parts) + " } }"
        repo = None
        for attempt in range(4):
            r = subprocess.run(["gh", "api", "graphql", "-f", f"query={q}"], capture_output=True, text=True)
            # GraphQL returns partial data plus an errors array when some aliases fail (e.g. a
            # number parsed from a vendored commit that is not a PR here); gh then exits 1 but
            # still prints the body, so parse stdout regardless of the exit code.
            try:
                data = json.loads(r.stdout) if r.stdout.strip() else {}
            except ValueError:
                data = {}
            repo = (data.get("data") or {}).get("repository")
            if repo is not None:
                break
            sys.stderr.write(f"batch {i // 100}: attempt {attempt + 1} failed: {r.stderr.strip()[:200]}\n")
            time.sleep(5 * (attempt + 1))
        if repo is None:
            sys.exit("giving up on GitHub API")
        for n in batch:
            node = repo.get(f"p{n}")
            if node:
                result[n] = {
                    "title": node["title"],
                    "merged_at": node["mergedAt"],
                    "labels": sorted(l["name"] for l in node["labels"]["nodes"]),
                    "author": (node.get("author") or {}).get("login"),
                }
        sys.stderr.write(f"fetched {min(i + 100, len(numbers))}/{len(numbers)}\n")
        time.sleep(0.5)
    return result


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="2025-10-20")
    ap.add_argument("--ref", default="origin/next")
    args = ap.parse_args()
    prs = local_prs(args.since, args.ref)
    sys.stderr.write(f"{len(prs)} merged PRs found in local history since {args.since}\n")
    meta = fetch_labels(sorted(prs))
    for n, rec in prs.items():
        rec.update(meta.get(n, {"title": None, "merged_at": None, "labels": [], "author": None}))
    label_counts: dict[str, int] = {}
    for rec in prs.values():
        for l in rec["labels"]:
            label_counts[l] = label_counts.get(l, 0) + 1
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "captured": dt.date.today().isoformat(),
                "since": args.since,
                "ref": args.ref,
                "source": "merge commits reachable from ref (dated >= since, deduplicated by PR number) + GitHub GraphQL pullRequest(number) for title/labels",
                "label_counts": dict(sorted(label_counts.items(), key=lambda kv: -kv[1])),
                "prs": [prs[n] for n in sorted(prs)],
            },
            fh,
            indent=1,
        )
    print(f"wrote {OUT}: {len(prs)} PRs, {sum(1 for p in prs.values() if p['labels'])} with labels")


if __name__ == "__main__":
    main()
