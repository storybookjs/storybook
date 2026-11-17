#!/usr/bin/env python3
"""Attach the issues each merged PR closes (with their labels) to signals/github-merged-prs.json,
so fix PRs can inherit the issue's sev:* label and unlabelled PRs can inherit a category.
GraphQL `closingIssuesReferences`, 100 PRs per call.

  python3 feature-audit/fetch_pr_issues.py
"""
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, "signals", "github-merged-prs.json")
doc = json.load(open(P, encoding="utf-8"))
prs = doc["prs"]
numbers = [p["number"] for p in prs]
result = {}
for i in range(0, len(numbers), 100):
    batch = numbers[i:i + 100]
    parts = [f'p{n}: pullRequest(number: {n}) {{ closingIssuesReferences(first: 10) {{ nodes {{ number labels(first: 30) {{ nodes {{ name }} }} }} }} }}' for n in batch]
    q = 'query { repository(owner:"storybookjs", name:"storybook") { ' + " ".join(parts) + " } }"
    repo = None
    for attempt in range(4):
        r = subprocess.run(["gh", "api", "graphql", "-f", f"query={q}"], capture_output=True, text=True)
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
            result[n] = [{"number": x["number"], "labels": sorted(l["name"] for l in x["labels"]["nodes"])} for x in node["closingIssuesReferences"]["nodes"]]
    sys.stderr.write(f"fetched {min(i + 100, len(numbers))}/{len(numbers)}\n")
    time.sleep(0.5)
for p in prs:
    p["closing_issues"] = result.get(p["number"], [])
doc["closing_issues_captured"] = time.strftime("%Y-%m-%d")
json.dump(doc, open(P, "w", encoding="utf-8"), indent=1)
with_issues = sum(1 for p in prs if p["closing_issues"])
sev = sum(1 for p in prs if any(l.startswith("sev:") for ci in p["closing_issues"] for l in ci["labels"]))
print(f"{len(prs)} PRs; {with_issues} close at least one issue; {sev} of those carry a sev:* label on a closed issue")
