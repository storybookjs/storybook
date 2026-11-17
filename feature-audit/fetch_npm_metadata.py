#!/usr/bin/env python3
"""Fetch npm registry metadata for every third-party dependency in metrics.json.

For each package we keep: releases in the last 12 months, days since last publish, unpacked size of
the latest version, whether the latest version is deprecated, and the number of distinct majors
published in the window. Output: signals/npm-packages.json (merged with any previous run, so reruns
only fetch missing packages unless --refresh).

  python3 feature-audit/fetch_npm_metadata.py [--refresh]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "signals", "npm-packages.json")
REGISTRY = "https://registry.npmjs.org/"


def fetch(pkg: str) -> dict | None:
    url = REGISTRY + urllib.parse.quote(pkg, safe="@")
    req = urllib.request.Request(url, headers={"User-Agent": "storybook-feature-audit/1.0"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(3 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError):
            time.sleep(3 * (attempt + 1))
    return None


def summarize(doc: dict, now: dt.datetime) -> dict:
    times = {v: t for v, t in doc.get("time", {}).items() if v not in ("created", "modified")}
    cutoff = now - dt.timedelta(days=365)
    recent = []
    for v, t in times.items():
        try:
            when = dt.datetime.fromisoformat(t.replace("Z", "+00:00"))
        except ValueError:
            continue
        if when >= cutoff:
            recent.append(v)
    last_publish = max((dt.datetime.fromisoformat(t.replace("Z", "+00:00")) for t in times.values()), default=None)
    latest = doc.get("dist-tags", {}).get("latest")
    latest_doc = doc.get("versions", {}).get(latest, {}) if latest else {}
    majors = {v.split(".")[0] for v in recent if v[0].isdigit()}
    return {
        "latest": latest,
        "releases_12mo": len(recent),
        "majors_12mo": len(majors),
        "days_since_last_publish": (now - last_publish).days if last_publish else None,
        "unpacked_size_kb": round(latest_doc.get("dist", {}).get("unpackedSize", 0) / 1024),
        "deprecated": bool(latest_doc.get("deprecated")),
        "license": latest_doc.get("license") if isinstance(latest_doc.get("license"), str) else None,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()
    with open(os.path.join(HERE, "metrics.json"), encoding="utf-8") as fh:
        metrics = json.load(fh)
    pkgs = sorted({d for f in metrics["features"] for d in f["deps"]})
    existing = {}
    if os.path.exists(OUT) and not args.refresh:
        with open(OUT, encoding="utf-8") as fh:
            existing = json.load(fh).get("packages", {})
    now = dt.datetime.now(dt.timezone.utc)
    packages = dict(existing)
    todo = [p for p in pkgs if p not in packages]
    sys.stderr.write(f"{len(pkgs)} packages, {len(todo)} to fetch\n")
    for i, pkg in enumerate(todo, 1):
        doc = fetch(pkg)
        packages[pkg] = summarize(doc, now) if doc else {"error": "not found"}
        if i % 20 == 0:
            sys.stderr.write(f"{i}/{len(todo)}\n")
        time.sleep(0.4)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump({"captured": now.date().isoformat(), "source": REGISTRY + "<pkg>", "packages": dict(sorted(packages.items()))}, fh, indent=1)
    ok = [p for p, v in packages.items() if "error" not in v]
    print(f"wrote {OUT}: {len(ok)} packages summarised, {len(packages) - len(ok)} not found")


if __name__ == "__main__":
    main()
