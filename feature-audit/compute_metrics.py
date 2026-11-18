#!/usr/bin/env python3
"""Compute per-feature maintenance-cost metrics for the Storybook feature audit.

Reads `features.toml` (feature map, usefulness scores, reach estimates, weights), scans the
repository with `git ls-files`, and writes:

  metrics.json     full per-feature and per-group data
  metrics.csv      flat per-feature table
  ranking.md       ranked table under four usefulness hypotheses, group rollup, dependency lists,
                   import graph, coverage report
  quadrants.md     the 2x2 (usefulness x cost), the sunset list, the simplification list, the
                   maintainer-only table and an agreement table across hypotheses

The work is split into `scan()` (expensive: files, imports, git history, PR attribution) and
`evaluate()` (cheap and pure: costs, hypotheses, ranks), so `sensitivity.py` can re-evaluate many
scenarios, one weight or modelling choice changed at a time, against one scan.

Signals (optional, under signals/): npm-downloads-last-month.json, github-open-issues-by-label.json,
github-merged-prs.json (from fetch_pr_labels.py + fetch_pr_issues.py), npm-packages.json (from
fetch_npm_metadata.py).

  python3 feature-audit/compute_metrics.py [--no-churn] [--no-signals]

Only the Python standard library is used (tomllib needs Python >= 3.11).
"""

from __future__ import annotations

import argparse
import collections
import copy
import csv
import json
import os
import posixpath
import re
import subprocess
import sys
import tomllib
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], cwd=HERE).decode().strip()

SRC_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".vue", ".svelte"}
RESOLVE_EXT = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs", ".vue", ".svelte", ".json"]
HYPOTHESES = ["linear", "geometric", "reach", "inherited"]

# File classification. Order matters: the first matching rule wins.
CLASSIFY_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("ignore", re.compile(r"(/ember-output/|/code/sandbox/|/\.storybook/static/|/dist/)")),
    ("fixture", re.compile(r"(fixtures?\.ts$|test-setup\.ts$|/template/|/__mocks__/|/__mocks-ng-workspace/|/__testfixtures__/|/__mockdata__/|/__for-testing__/|/fixtures?/|mockdata|\.mock\.|\.story-helpers\.|/sync-test/|/sync-simulation/|/test-support/|/test-utils?\.|/sandbox-baselines/|/perf/fixtures/|/code/sandbox/)")),
    ("test", re.compile(r"(\.(test|spec|test-d)\.[cm]?[jt]sx?$|/__tests__/|/__tests/|/tests/|/e2e-internal/|/e2e-sandbox/|vitest\.config\.|vitest-setup|playwright\.config|/code/\.storybook/|/compare/|/perf/)")),
    ("stories", re.compile(r"\.stories\.[cm]?[jt]sx?$|\.stories\.(vue|svelte)$")),
    ("dts", re.compile(r"\.d\.ts$")),
]

IMPORT_RE = re.compile(
    r"""(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s*['"]([^'"\n]+)['"]"""
    r"""|(?:^|[^\w$.])(?:require|import)\(\s*['"]([^'"\n]+)['"]"""
)
NODE_BUILTINS = set(
    "assert async_hooks buffer child_process cluster console constants crypto dgram dns domain events fs http http2 "
    "https inspector module net os path perf_hooks process punycode querystring readline repl stream string_decoder "
    "timers tls tty url util v8 vm wasi worker_threads zlib test".split()
)
NPM_NAME_RE = re.compile(r"^(@[a-z0-9-~][a-z0-9-._~]*/)?[a-z0-9-~][a-z0-9-._~]*$")


@dataclass
class Feature:
    id: str
    group: str
    name: str
    include: list[str]
    exclude: list[str]
    usefulness: int
    rationale: str
    issue_labels: list[str]
    npm: list[str]
    flags: list[str]
    reach: float | None
    reach_rationale: str
    maintainer_only: bool
    include_re: list[tuple[re.Pattern[str], int]] = field(default_factory=list)
    exclude_re: list[re.Pattern[str]] = field(default_factory=list)


# --------------------------------------------------------------------------- helpers


def glob_to_regex(pattern: str) -> re.Pattern[str]:
    out = []
    i = 0
    while i < len(pattern):
        c = pattern[i]
        if pattern.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
            continue
        if pattern.startswith("**", i):
            out.append(".*")
            i += 2
            continue
        if c == "*":
            out.append("[^/]*")
        elif c == "?":
            out.append("[^/]")
        else:
            out.append(re.escape(c))
        i += 1
    return re.compile("^" + "".join(out) + "$")


def specificity(pattern: str) -> int:
    return len(re.sub(r"[*?]", "", pattern))


def classify(path: str) -> str | None:
    if os.path.splitext(path)[1] not in SRC_EXT:
        return None
    p = "/" + path
    for label, rx in CLASSIFY_RULES:
        if rx.search(p):
            return label
    return "src"


def count_lines(path: str) -> int:
    try:
        with open(os.path.join(ROOT, path), "rb") as fh:
            return sum(1 for _ in fh)
    except OSError:
        return 0


def read_text(path: str) -> str:
    try:
        with open(os.path.join(ROOT, path), encoding="utf-8", errors="ignore") as fh:
            return fh.read()
    except OSError:
        return ""


def fmt(n: float | None) -> str:
    return "" if n is None else f"{n:,.0f}"


def load_json(name: str) -> dict:
    p = os.path.join(HERE, "signals", name)
    if not os.path.exists(p):
        return {}
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


# --------------------------------------------------------------------------- config


def load_config() -> tuple[dict, list[dict], list[Feature]]:
    with open(os.path.join(HERE, "features.toml"), "rb") as fh:
        cfg = tomllib.load(fh)
    features = []
    for f in cfg["feature"]:
        feat = Feature(
            id=f["id"], group=f["group"], name=f["name"], include=f.get("include", []), exclude=f.get("exclude", []),
            usefulness=int(f["usefulness"]), rationale=f.get("rationale", ""), issue_labels=f.get("issue_labels", []),
            npm=f.get("npm", []), flags=f.get("flags", []), reach=f.get("reach"), reach_rationale=f.get("reach_rationale", ""),
            maintainer_only=bool(f.get("maintainer_only", False)),
        )
        feat.include_re = [(glob_to_regex(p), specificity(p)) for p in feat.include]
        feat.exclude_re = [glob_to_regex(p) for p in feat.exclude]
        features.append(feat)
    ids = [f.id for f in features]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        sys.exit(f"duplicate feature ids: {sorted(dupes)}")
    group_ids = {g["id"] for g in cfg["group"]}
    for f in features:
        if f.group not in group_ids:
            sys.exit(f"feature {f.id} references unknown group {f.group}")
    return cfg, cfg["group"], features


def assign(path: str, features: list[Feature]) -> tuple[Feature | None, list[str]]:
    """Return the most specific matching feature and the ids of equally specific rivals."""
    best: list[tuple[int, Feature]] = []
    for feat in features:
        if any(rx.match(path) for rx in feat.exclude_re):
            continue
        spec = max((s for rx, s in feat.include_re if rx.match(path)), default=-1)
        if spec >= 0:
            best.append((spec, feat))
    if not best:
        return None, []
    best.sort(key=lambda t: -t[0])
    top = best[0][0]
    return best[0][1], [f.id for s, f in best[1:] if s == top]


# --------------------------------------------------------------------------- packages


def workspace_packages() -> dict[str, str]:
    """Workspace package name -> package directory (repo-relative)."""
    out = subprocess.check_output(["git", "ls-files", "--", "*package.json"], cwd=ROOT).decode().split("\n")
    pkgs: dict[str, str] = {}
    for f in out:
        if not f or "node_modules" in f or "/template/" in f or "/fixtures/" in f or "/__" in f:
            continue
        try:
            with open(os.path.join(ROOT, f), encoding="utf-8") as fh:
                name = json.load(fh).get("name")
        except (OSError, ValueError):
            continue
        if name and name not in pkgs:
            pkgs[name] = os.path.dirname(f)
    return pkgs


_installed_cache: dict[str, bool] = {}


def is_installed(pkg: str, importer: str) -> bool:
    if pkg in _installed_cache:
        return _installed_cache[pkg]
    roots = [ROOT, os.path.join(ROOT, "code"), os.path.join(ROOT, "scripts"), os.path.join(ROOT, "agent-eval")]
    d = os.path.dirname(os.path.join(ROOT, importer))
    while d.startswith(ROOT):
        if os.path.exists(os.path.join(d, "package.json")):
            roots.append(d)
            break
        d = os.path.dirname(d)
    found = any(os.path.isdir(os.path.join(r, "node_modules", pkg)) for r in roots)
    _installed_cache[pkg] = found
    return found


def core_entry_map() -> dict[str, str]:
    """`storybook/<subpath>` import specifier -> source file under code/core, from build-config.ts."""
    text = read_text("code/core/build-config.ts")
    mapping: dict[str, str] = {}
    for block in re.finditer(r"\{[^{}]*\}", text):
        b = block.group(0)
        entry = re.search(r"entryPoint:\s*'([^']+)'", b)
        exports = re.search(r"exportEntries:\s*\[([^\]]*)\]", b)
        if not entry or not exports:
            continue
        src = posixpath.normpath(posixpath.join("code/core", entry.group(1)))
        for e in re.findall(r"'([^']+)'", exports.group(1)):
            mapping["storybook/" + e.lstrip("./")] = src
    return mapping


def parse_imports(text: str) -> list[str]:
    return [m.group(1) or m.group(2) for m in IMPORT_RE.finditer(text) if (m.group(1) or m.group(2))]


def resolve_relative(importer: str, spec: str, known: set[str]) -> str | None:
    base = posixpath.normpath(posixpath.join(posixpath.dirname(importer), spec))
    cands = [base]
    stem = base[:-3] if base.endswith(".js") else base
    cands += [stem + ext for ext in RESOLVE_EXT]
    cands += [posixpath.join(base, "index" + ext) for ext in RESOLVE_EXT]
    for c in cands:
        if c in known:
            return c
    return None


# --------------------------------------------------------------------------- churn


def churn_by_commit(since: str, bulk_threshold: int, roots: list[str]) -> tuple[dict[str, set[str]], int, int]:
    out = subprocess.check_output(
        ["git", "log", f"--since={since}", "--no-merges", "--name-only", "--pretty=format:%H", "--", *roots], cwd=ROOT
    ).decode()
    per_commit: dict[str, list[str]] = collections.defaultdict(list)
    cur = None
    for line in out.split("\n"):
        line = line.strip()
        if not line:
            continue
        if len(line) == 40 and all(c in "0123456789abcdef" for c in line):
            cur = line
            continue
        if cur:
            per_commit[cur].append(line)
    commits_by_file: dict[str, set[str]] = collections.defaultdict(set)
    skipped = 0
    for sha, files in per_commit.items():
        if len(files) > bulk_threshold:
            skipped += 1
            continue
        for f in files:
            commits_by_file[f].add(sha)
    return commits_by_file, len(per_commit), skipped


def pr_category(labels: list[str], subject: str, categories: list[dict]) -> str:
    L = set(labels)
    for rule in categories:
        if any(l in L for l in rule["labels"]):
            return rule["category"]
        if any(re.search(p, subject) for p in rule.get("subject_patterns", [])):
            return rule["category"]
    return "other"


def pr_severity(labels: list[str], closing_issues: list[dict] | None = None) -> str:
    """Most severe sev:* label on the PR, else on the issues it closes, else "none"."""
    sevs = sorted(l for l in labels if re.match(r"^sev:S\d$", l))
    if not sevs and closing_issues:
        sevs = sorted(l for ci in closing_issues for l in ci.get("labels", []) if re.match(r"^sev:S\d$", l))
    return sevs[0] if sevs else "none"  # sev:S1 sorts first and is the most severe


# --------------------------------------------------------------------------- scan (expensive)


def scan(cfg: dict, groups: list[dict], features: list[Feature], no_churn: bool = False, no_signals: bool = False) -> dict:
    meta = cfg["meta"]
    churn_cfg = cfg.get("churn", {})
    group_name = {g["id"]: g["name"] for g in groups}
    group_internal = {g["id"]: bool(g.get("maintainer_only", False)) for g in groups}
    head = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT).decode().strip()

    files = [f for f in subprocess.check_output(["git", "ls-files", "--", *meta["scan_roots"]], cwd=ROOT).decode().split("\n") if f]
    known_files = set(files)
    workspace = workspace_packages()
    entry_map = core_entry_map()

    signals_on = not no_signals
    issues = load_json("github-open-issues-by-label.json").get("counts", {}) if signals_on else {}
    npm_dl = load_json("npm-downloads-last-month.json").get("downloads", {}) if signals_on else {}
    npm_pkgs = load_json("npm-packages.json").get("packages", {}) if signals_on else {}
    prs_doc = load_json("github-merged-prs.json") if (signals_on and not no_churn) else {}
    # A third-party import counts when the package is installed under some node_modules, or, in a
    # checkout without node_modules, when the registry snapshot already knows it. Without either, no
    # dependency would be counted and the cost model would silently lose its dependency term.
    node_modules_present = any(os.path.isdir(os.path.join(ROOT, r, "node_modules")) for r in ["", "code", "scripts", "agent-eval"])
    dep_detection = {"node_modules_present": node_modules_present, "from_registry_snapshot": 0}
    if not node_modules_present and not npm_pkgs:
        print("warning: no node_modules and no signals/npm-packages.json; third-party dependencies cannot be detected", file=sys.stderr)

    per_feature: dict[str, dict] = {}
    for f in features:
        per_feature[f.id] = {
            "id": f.id, "group": f.group, "group_name": group_name[f.group],
            "maintainer_only": group_internal[f.group] or f.maintainer_only,
            "name": f.name, "files": 0, "src_loc": 0, "test_loc": 0, "stories_loc": 0, "fixture_loc": 0, "dts_loc": 0,
            "deps": set(), "internal_deps": set(), "imports_from": collections.Counter(),
            "churn_commits": set(), "prs": collections.Counter(), "prs_fix_severity": collections.Counter(), "pr_numbers": set(),
        }
    file_to_feature: dict[str, str] = {}
    unassigned: collections.Counter = collections.Counter()
    unassigned_files: list[tuple[str, int]] = []
    conflicts: list[tuple[str, str, list[str]]] = []
    src_imports: dict[str, list[str]] = {}

    for path in files:
        kind = classify(path)
        if kind is None or kind == "ignore":
            continue
        feat, rivals = assign(path, features)
        loc = count_lines(path)
        if feat is None:
            key = "/".join(path.split("/")[:4]) if path.startswith("code/core/src/") else "/".join(path.split("/")[:3])
            unassigned[key] += loc
            unassigned_files.append((path, loc))
            continue
        if rivals:
            conflicts.append((path, feat.id, rivals))
        file_to_feature[path] = feat.id
        rec = per_feature[feat.id]
        rec["files"] += 1
        rec[f"{kind}_loc"] += loc
        if kind == "src":
            src_imports[path] = parse_imports(read_text(path))

    def dir_owner(pkg_dir: str) -> str | None:
        for cand in ("src/index.ts", "src/index.tsx", "src/index.js", "src/preset.ts"):
            fid = file_to_feature.get(posixpath.join(pkg_dir, cand))
            if fid:
                return fid
        counts = collections.Counter(fid for p, fid in file_to_feature.items() if p.startswith(pkg_dir + "/"))
        return counts.most_common(1)[0][0] if counts else None

    pkg_owner = {name: dir_owner(d) for name, d in workspace.items()}
    for spec, src in list(entry_map.items()):
        entry_map[spec] = file_to_feature.get(src, "")

    for path, specs in src_imports.items():
        fid = file_to_feature[path]
        rec = per_feature[fid]
        for spec in specs:
            if spec.startswith("."):
                target = resolve_relative(path, spec, known_files)
                tfid = file_to_feature.get(target) if target else None
                if tfid and tfid != fid:
                    rec["imports_from"][tfid] += 1
                continue
            if spec[0] in "/#$" or spec.startswith("node:") or spec.startswith("virtual:"):
                continue
            if spec == "storybook" or spec.startswith("storybook/"):
                tfid = entry_map.get(spec) or entry_map.get(spec.replace("storybook/internal/", "storybook/"))
                if tfid and tfid != fid:
                    rec["imports_from"][tfid] += 1
                continue
            parts = spec.split("/")
            pkg = "/".join(parts[:2]) if spec.startswith("@") else parts[0]
            if pkg in NODE_BUILTINS or not NPM_NAME_RE.match(pkg):
                continue
            if pkg in workspace:
                rec["internal_deps"].add(pkg)
                tfid = pkg_owner.get(pkg)
                if tfid and tfid != fid:
                    rec["imports_from"][tfid] += 1
            elif is_installed(pkg, path):
                rec["deps"].add(pkg)
            elif pkg in npm_pkgs:
                if pkg not in rec["deps"]:
                    dep_detection["from_registry_snapshot"] += 1
                rec["deps"].add(pkg)

    churn_meta: dict = {}
    if not no_churn:
        commits_by_file, total_commits, skipped = churn_by_commit(meta["churn_since"], int(meta["churn_bulk_commit_threshold"]), meta["scan_roots"])
        churn_meta = {"since": meta["churn_since"], "commits_scanned": total_commits, "bulk_commits_skipped": skipped}
        for path, shas in commits_by_file.items():
            fid = file_to_feature.get(path)
            if fid is None:
                feat, _ = assign(path, features)  # deleted paths still match globs
                fid = feat.id if feat else None
            if fid:
                per_feature[fid]["churn_commits"] |= shas
        if prs_doc:
            cats = churn_cfg.get("categories", [])
            bulk = int(churn_cfg.get("bulk_files_threshold", 60))
            infer = bool(churn_cfg.get("infer_category_from_issues", False))
            counted = skipped_prs = inferred_total = 0
            cat_totals: collections.Counter = collections.Counter()
            sev_totals: collections.Counter = collections.Counter()
            for pr in prs_doc.get("prs", []):
                cat = pr_category(pr.get("labels", []), pr.get("subject", "") + " " + (pr.get("title") or ""), cats)
                inferred = False
                if cat == "other" and infer and pr.get("closing_issues"):
                    issue_labels = [l for ci in pr["closing_issues"] for l in ci.get("labels", [])]
                    cat2 = pr_category(issue_labels, "", cats)
                    if cat2 != "other":
                        cat, inferred = cat2, True
                if cat in churn_cfg.get("ignore_categories", []) or len(pr["files"]) > bulk:
                    skipped_prs += 1
                    continue
                counted += 1
                cat_totals[cat] += 1
                inferred_total += int(inferred)
                sev = pr_severity(pr.get("labels", []), pr.get("closing_issues"))
                if cat == "fix":
                    sev_totals[sev] += 1
                touched: set[str] = set()
                for path in pr["files"]:
                    fid = file_to_feature.get(path)
                    if fid is None and classify(path) not in (None, "ignore"):
                        feat, _ = assign(path, features)
                        fid = feat.id if feat else None
                    if fid:
                        touched.add(fid)
                for fid in touched:
                    per_feature[fid]["prs"][cat] += 1
                    per_feature[fid]["pr_numbers"].add(pr["number"])
                    if cat == "fix":
                        per_feature[fid]["prs_fix_severity"][sev] += 1
            churn_meta["prs"] = {"since": prs_doc.get("since"), "total": len(prs_doc.get("prs", [])), "counted": counted,
                                 "skipped": skipped_prs, "by_category": dict(cat_totals), "fix_by_severity": dict(sev_totals),
                                 "category_inferred_from_issues": inferred_total}

    dep_users: collections.Counter = collections.Counter()
    for rec in per_feature.values():
        for d in rec["deps"]:
            dep_users[d] += 1

    for rec in per_feature.values():
        rec["deps"] = sorted(rec["deps"])
        rec["internal_deps"] = sorted(rec["internal_deps"])
        rec["imports_from"] = dict(rec["imports_from"].most_common())
        rec["churn_commits"] = len(rec["churn_commits"])
        rec["prs"] = dict(rec["prs"])
        rec["prs_fix_severity"] = dict(rec["prs_fix_severity"])
        rec["prs_total"] = len(rec["pr_numbers"])
        del rec["pr_numbers"]

    total_src_scanned = sum(r["src_loc"] for r in per_feature.values()) + sum(loc for p, loc in unassigned_files if classify(p) == "src")
    coverage = {
        "assigned_src_loc": sum(r["src_loc"] for r in per_feature.values()),
        "total_src_loc": total_src_scanned,
        "unassigned_src_loc": sum(loc for p, loc in unassigned_files if classify(p) == "src"),
        "unassigned_files": len(unassigned_files),
        "unassigned_file_list": sorted(unassigned_files, key=lambda pl: (-pl[1], pl[0]))[:200],
        "unassigned_by_dir": dict(sorted(unassigned.items(), key=lambda kv: -kv[1])[:40]),
        "conflicts": conflicts[:200], "n_conflicts": len(conflicts),
    }
    return {
        "per_feature": per_feature, "coverage": coverage, "churn_meta": churn_meta, "dep_users": dict(dep_users), "scanned_head": head,
        "dep_detection": dep_detection,
        "signals": {"issues": issues, "npm_downloads": npm_dl, "npm_packages": npm_pkgs, "prs_loaded": bool(prs_doc)},
    }


# --------------------------------------------------------------------------- evaluate (cheap, pure)


def evaluate(data: dict, cfg: dict, groups: list[dict], features: list[Feature], overrides: dict | None = None) -> tuple[list[dict], list[dict]]:
    """Costs, hypotheses and ranks from a scan. `overrides` may carry `weights` (dict), `usefulness`
    (feature id -> 1..4) and `reach` (feature id -> 0..1) to change the model without rescanning."""
    overrides = overrides or {}
    weights = {**cfg["weights"], **overrides.get("weights", {})}
    use_cfg = cfg.get("usefulness", {})
    churn_cfg = cfg.get("churn", {})
    u_over = overrides.get("usefulness", {})
    r_over = overrides.get("reach", {})
    by_id = {f.id: f for f in features}
    issues = data["signals"]["issues"]
    npm_dl = data["signals"]["npm_downloads"]
    npm_pkgs = data["signals"]["npm_packages"]
    dep_users = data["dep_users"]

    w_dep_base = float(weights.get("dependency_base", weights.get("dependency", 250)))
    w_dep_rel = float(weights.get("dependency_per_release", 0))
    dep_rel_cap = float(weights.get("dependency_release_cap", 200))
    w_dep_stale = float(weights.get("dependency_stale_penalty", 0))
    stale_days = int(weights.get("dependency_stale_days", 730))
    w_test = float(weights["test_loc"])
    w_fix = float(weights.get("fix_pr", 0))
    w_maint = float(weights.get("maintenance_pr", 0))
    w_commit = float(weights.get("churn", 0))
    w_fan_out = float(weights.get("internal_fan_out", 0))
    sev_mult = {k: float(v) for k, v in churn_cfg.get("severity_multipliers", {}).items()}

    def is_stale(pkg: str) -> bool:
        info = npm_pkgs.get(pkg) or {}
        return bool(info) and "error" not in info and (((info.get("days_since_last_publish") or 0) > stale_days) or bool(info.get("deprecated")))

    def dep_cost(pkg: str) -> float:
        info = npm_pkgs.get(pkg) or {}
        if "error" in info or not info:
            return w_dep_base
        rel = min(float(info.get("releases_12mo", 0) or 0), dep_rel_cap)
        return w_dep_base + w_dep_rel * rel + (w_dep_stale if is_stale(pkg) else 0)

    geo_base = float(use_cfg.get("geometric_base", 3))
    side_bases = [float(b) for b in use_cfg.get("geometric_bases_side_by_side", [])]
    reach_default = {int(k): float(v) for k, v in use_cfg.get("reach_default", {"4": 1.0, "3": 0.5, "2": 0.2, "1": 0.05}).items()}
    reach_ref = float(npm_dl.get(use_cfg.get("reach_reference_package", "storybook"), 0) or 0)
    reach_floor = float(use_cfg.get("reach_floor", 0.01))

    def usefulness_of(f: Feature) -> int:
        return int(u_over.get(f.id, f.usefulness))

    def reach_of(f: Feature) -> tuple[float, str]:
        if f.id in r_over:
            return max(reach_floor, min(1.0, float(r_over[f.id]))), "override"
        if f.reach is not None:
            return max(reach_floor, min(1.0, float(f.reach))), "explicit"
        if npm_dl and f.npm and reach_ref:
            best = max((npm_dl.get(p, 0) for p in f.npm), default=0)
            if best:
                return max(reach_floor, min(1.0, best / reach_ref)), "npm"
        return reach_default.get(usefulness_of(f), 0.2), "default"

    # strong dependents graph for inherited usefulness
    aggregators = set(use_cfg.get("inheritance_exclude_importers", []))
    min_imports = int(use_cfg.get("inheritance_min_imports", 3))
    same_group_ok = not bool(use_cfg.get("inheritance_ignore_same_group", False))
    pf = data["per_feature"]
    dependents: dict[str, set[str]] = collections.defaultdict(set)
    importers_raw: dict[str, set[str]] = collections.defaultdict(set)
    for rec in pf.values():
        for tgt, n in rec["imports_from"].items():
            importers_raw[tgt].add(rec["id"])
            if rec["id"] in aggregators or rec["maintainer_only"] or pf[tgt]["maintainer_only"]:
                continue
            if n >= min_imports and (same_group_ok or rec["group"] != pf[tgt]["group"]):
                dependents[tgt].add(rec["id"])
    inherited: dict[str, int] = {fid: usefulness_of(by_id[fid]) for fid in pf}
    if use_cfg.get("inheritance_transitive", True):
        changed = True
        while changed:
            changed = False
            for fid, deps in dependents.items():
                m = max((inherited[d] for d in deps), default=0)
                if m > inherited[fid]:
                    inherited[fid] = m
                    changed = True
    else:
        for fid, deps in dependents.items():
            inherited[fid] = max([usefulness_of(by_id[fid])] + [usefulness_of(by_id[d]) for d in deps])

    rows = []
    for f in features:
        src = pf[f.id]
        rec = {k: copy.copy(v) for k, v in src.items()}
        U = usefulness_of(f)
        rec.update({"usefulness": U, "rationale": f.rationale, "flags": f.flags, "issue_labels": f.issue_labels, "npm": f.npm,
                    "reach_rationale": f.reach_rationale})
        rec["imported_by"] = sorted(dependents.get(f.id, ()))
        rec["imported_by_raw"] = sorted(importers_raw.get(f.id, ()))
        rec["fan_out"] = len(rec["imports_from"])
        rec["fan_in"] = len(rec["imported_by_raw"])
        rec["fan_in_strong"] = len(rec["imported_by"])
        rec["n_deps"] = len(rec["deps"])
        rec["exclusive_deps"] = [d for d in rec["deps"] if dep_users.get(d, 0) == 1]
        rec["n_exclusive_deps"] = len(rec["exclusive_deps"])
        rec["deps_cost"] = round(sum(dep_cost(d) for d in rec["deps"]))
        rec["exclusive_deps_cost"] = round(sum(dep_cost(d) for d in rec["exclusive_deps"]))
        rec["deps_stale"] = [d for d in rec["deps"] if is_stale(d)]
        rec["deps_releases_12mo"] = sum(int((npm_pkgs.get(d) or {}).get("releases_12mo", 0) or 0) for d in rec["deps"])
        prs = rec["prs"]
        rec["prs_fix"] = prs.get("fix", 0)
        rec["prs_feature"] = prs.get("feature", 0)
        rec["prs_maintenance"] = prs.get("maintenance", 0)
        rec["prs_docs"] = prs.get("docs", 0)
        rec["prs_fix_weighted"] = round(sum(n * sev_mult.get(sev, 1.0) for sev, n in rec["prs_fix_severity"].items()), 1)
        rec["nonsrc_loc"] = rec["test_loc"] + rec["stories_loc"] + rec["fixture_loc"]
        rec["open_issues"] = sum(issues.get(l, 0) for l in f.issue_labels) if issues else None
        rec["npm_downloads"] = max((npm_dl.get(p, 0) for p in f.npm), default=None) if (npm_dl and f.npm) else None
        rec["cost_code"] = rec["src_loc"] + w_test * rec["nonsrc_loc"]
        rec["cost_churn"] = w_fix * rec["prs_fix_weighted"] + w_maint * rec["prs_maintenance"] + w_commit * rec["churn_commits"]
        rec["cost_coupling"] = w_fan_out * rec["fan_out"]
        rec["cost"] = rec["cost_code"] + rec["deps_cost"] + rec["cost_churn"] + rec["cost_coupling"]
        rec["cost_exclusive"] = rec["cost_code"] + rec["exclusive_deps_cost"] + rec["cost_churn"]
        reach, reach_src = reach_of(f)
        rec["reach"] = round(reach, 4)
        rec["reach_source"] = reach_src
        rec["usefulness_inherited"] = inherited[f.id]
        rec["u_linear"] = U
        rec["u_geometric"] = geo_base ** (U - 1)
        rec["u_reach"] = reach
        rec["u_inherited"] = geo_base ** (inherited[f.id] - 1)
        rec["ratio_linear"] = rec["cost"] / rec["u_linear"]
        rec["ratio_geometric"] = rec["cost"] / rec["u_geometric"]
        rec["ratio_reach"] = rec["cost"] / max(reach, 1e-6)
        rec["ratio_inherited"] = rec["cost"] / rec["u_inherited"]
        rec["ratio_exclusive_geometric"] = rec["cost_exclusive"] / rec["u_geometric"]
        for b in side_bases:
            rec[f"ratio_geometric{b:g}"] = rec["cost"] / (b ** (U - 1))
        rows.append(rec)

    for h in HYPOTHESES + [f"geometric{b:g}" for b in side_bases]:
        for i, r in enumerate(sorted(rows, key=lambda r: -r[f"ratio_{h}"]), 1):
            r[f"rank_{h}"] = i
    for r in rows:
        ranks = [r[f"rank_{h}"] for h in HYPOTHESES]
        r["rank_mean"] = sum(ranks) / len(ranks)
        r["rank_spread"] = max(ranks) - min(ranks)
    rows.sort(key=lambda r: -r["ratio_geometric"])
    for i, r in enumerate(rows, 1):
        r["rank"] = i

    group_internal = {g["id"]: bool(g.get("maintainer_only", False)) for g in groups}
    group_rows = []
    for g in groups:
        members = [r for r in rows if r["group"] == g["id"]]
        if not members:
            continue
        deps = sorted({d for r in members for d in r["deps"]})
        cost = sum(r["cost"] for r in members)
        weighted_u = sum(r["usefulness"] * r["cost"] for r in members) / cost if cost else 0
        group_rows.append({
            "id": g["id"], "name": g["name"], "description": g.get("description", ""), "maintainer_only": group_internal[g["id"]],
            "features": len(members), "src_loc": sum(r["src_loc"] for r in members), "nonsrc_loc": sum(r["nonsrc_loc"] for r in members),
            "n_deps": len(deps), "deps": deps, "churn_commits": sum(r["churn_commits"] for r in members),
            "prs_fix": sum(r["prs_fix"] for r in members), "prs_feature": sum(r["prs_feature"] for r in members),
            "prs_maintenance": sum(r["prs_maintenance"] for r in members),
            "cost_code": sum(r["cost_code"] for r in members), "deps_cost": sum(r["deps_cost"] for r in members),
            "cost_churn": sum(r["cost_churn"] for r in members),
            "cost": cost, "cost_weighted_usefulness": weighted_u, "cost_per_usefulness": cost / weighted_u if weighted_u else 0,
        })
    group_rows.sort(key=lambda g: -g["cost_per_usefulness"])
    return rows, group_rows


def quadrant_of(r: dict, median_cost: float) -> str:
    hi_u = r["usefulness"] >= 3
    hi_c = r["cost"] >= median_cost
    return {(True, True): "simplify", (True, False): "protect", (False, True): "sunset", (False, False): "cheap"}[(hi_u, hi_c)]


def median_user_cost(rows: list[dict]) -> float:
    costs = sorted(r["cost"] for r in rows if not r["maintainer_only"])
    return costs[len(costs) // 2] if costs else 0


# --------------------------------------------------------------------------- reports


def write_outputs(rows: list[dict], group_rows: list[dict], data: dict, cfg: dict) -> None:
    meta, weights, use_cfg, churn_cfg = cfg["meta"], cfg["weights"], cfg.get("usefulness", {}), cfg.get("churn", {})
    coverage, churn_meta = data["coverage"], data["churn_meta"]
    npm_pkgs, dep_users = data["signals"]["npm_packages"], data["dep_users"]
    geo_base = float(use_cfg.get("geometric_base", 3))
    side_bases = [float(b) for b in use_cfg.get("geometric_bases_side_by_side", [])]

    out = {
        "meta": {**meta, "scanned_head": data["scanned_head"], "dep_detection": data.get("dep_detection", {}), "weights": weights, "usefulness": use_cfg, "churn_config": churn_cfg, "churn": churn_meta,
                 "signals_loaded": {k: bool(v) for k, v in data["signals"].items()}},
        "features": rows, "groups": group_rows, "coverage": coverage, "dependency_users": dep_users,
    }
    with open(os.path.join(HERE, "metrics.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2)

    cols = ["rank", "id", "group", "name", "usefulness", "usefulness_inherited", "reach", "reach_source", "src_loc", "test_loc", "stories_loc",
            "fixture_loc", "n_deps", "n_exclusive_deps", "deps_cost", "exclusive_deps_cost", "fan_in", "fan_in_strong", "fan_out", "churn_commits",
            "prs_total", "prs_fix", "prs_fix_weighted", "prs_feature", "prs_maintenance", "prs_docs", "open_issues", "npm_downloads",
            "cost", "cost_exclusive", "ratio_linear", "ratio_geometric", "ratio_reach", "ratio_inherited", "ratio_exclusive_geometric",
            "rank_linear", "rank_geometric", "rank_reach", "rank_inherited", "rank_mean", "rank_spread", "deps", "exclusive_deps"]
    with open(os.path.join(HERE, "metrics.csv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        for r in rows:
            w.writerow([";".join(r[c]) if c in ("deps", "exclusive_deps") else (round(r[c], 2) if isinstance(r[c], float) else r[c]) for c in cols])

    sev = churn_cfg.get("severity_multipliers", {})
    md = []
    md.append("# Feature ranking by maintenance cost per unit of usefulness\n")
    md.append(f"Generated by `compute_metrics.py`; feature map captured at `{meta['commit']}` ({meta['captured']}), scanned at `{data['scanned_head']}`.\n")
    dd = data.get("dep_detection", {})
    if dd and not dd.get("node_modules_present"):
        md.append(f"Third-party dependencies were detected from the registry snapshot (`signals/npm-packages.json`) because the checkout has no `node_modules`; "
                  f"{dd.get('from_registry_snapshot', 0)} feature-dependency pairs were resolved that way. Packages added since the snapshot are not counted.\n")
    md.append("**Cost** = src LOC + {t} × (test+stories+fixture LOC) + Σ dependency cost + {fx} × severity-weighted bug-fix PRs + {mt} × maintenance PRs"
              " + {co} × commits + {fo} × internal fan-out. Dependency cost = {b} + {pr} × releases in 12 months (capped at {cap}) + {st} if the package"
              " has not been published for {sd} days or is deprecated. Severity multipliers: {sv}.\n".format(
                  t=weights["test_loc"], fx=weights.get("fix_pr", 0), mt=weights.get("maintenance_pr", 0), co=weights.get("churn", 0),
                  fo=weights.get("internal_fan_out", 0), b=weights.get("dependency_base", weights.get("dependency", 250)),
                  pr=weights.get("dependency_per_release", 0), cap=weights.get("dependency_release_cap", 200),
                  st=weights.get("dependency_stale_penalty", 0), sd=weights.get("dependency_stale_days", 730), sv=sev))
    md.append("**Usefulness hypotheses** (the denominator): `linear` = score 1–4 as is; `geometric` = each usefulness level is worth {g:g}× the level below"
              " (the \"base\" is that multiplier: low=1, medium={g:g}, high={g2:g}, mission-critical={g3:g}); side-by-side columns show the same ranking with multipliers {sb};"
              " `reach` = estimated share of installs (an explicit `reach` in features.toml, else npm downloads of the feature's package ÷ downloads of"
              " `storybook`, else a default per score of {rd}; floored at {rf}); `inherited` = geometric score after each feature inherits the highest score of"
              " any non-aggregator feature in another group that imports it from ≥{mi} places{tr}. Higher ratio = more expensive for what it gives.\n".format(
                  g=geo_base, g2=geo_base**2, g3=geo_base**3, sb=", ".join(f"{b:g}×" for b in side_bases) or "none", rd=use_cfg.get("reach_default", {}),
                  rf=use_cfg.get("reach_floor", 0.01), mi=use_cfg.get("inheritance_min_imports", 3), tr=" (transitively)" if use_cfg.get("inheritance_transitive", True) else ""))
    if churn_meta:
        md.append(f"Churn: non-merge commits since {churn_meta['since']} ({churn_meta['commits_scanned']} scanned, {churn_meta['bulk_commits_skipped']} bulk commits ignored).")
        if churn_meta.get("prs"):
            p = churn_meta["prs"]
            md.append(f" Labelled PRs since {p['since']}: {p['counted']} counted of {p['total']} ({p['skipped']} release/bulk skipped); by category {p['by_category']}; fix PRs by severity {p.get('fix_by_severity')}; {p.get('category_inferred_from_issues', 0)} categories inferred from closed issues.")
        md.append("")
    md.append("## Leaf features (sorted by the geometric hypothesis)\n")
    sb_head = "".join(f" Rank {b:g}× |" for b in side_bases)
    sb_sep = "--:|" * len(side_bases)
    md.append("| # | Feature | Group | U | U inh | Reach | Src LOC | Non-src LOC | Deps (excl.) | Dep cost | Fan in/out | PRs fix (weighted)/feat/maint | Issues | Cost | Cost/U lin | Cost/U geo | Cost/reach | Cost/U inh | Rank lin/geo/reach/inh |" + sb_head)
    md.append("|--:|---|---|:-:|:-:|--:|--:|--:|--:|--:|:-:|:-:|--:|--:|--:|--:|--:|--:|:-:|" + sb_sep)
    for r in rows:
        mark = {"npm": "*", "explicit": "†", "override": "‡"}.get(r["reach_source"], "")
        md.append(
            f"| {r['rank']} | {r['name']} (`{r['id']}`) | {r['group']} | {r['usefulness']} | {r['usefulness_inherited']} | {r['reach']:.2f}{mark} | "
            f"{fmt(r['src_loc'])} | {fmt(r['nonsrc_loc'])} | {r['n_deps']} ({r['n_exclusive_deps']}) | {fmt(r['deps_cost'])} | {r['fan_in']}/{r['fan_out']} | "
            f"{r['prs_fix']} ({r['prs_fix_weighted']:g})/{r['prs_feature']}/{r['prs_maintenance']} | {'' if r['open_issues'] is None else r['open_issues']} | {fmt(r['cost'])} | "
            f"{fmt(r['ratio_linear'])} | {fmt(r['ratio_geometric'])} | {fmt(r['ratio_reach'])} | {fmt(r['ratio_inherited'])} | "
            f"{r['rank_linear']}/{r['rank_geometric']}/{r['rank_reach']}/{r['rank_inherited']} |"
            + "".join(f" {r[f'rank_geometric{b:g}']} |" for b in side_bases)
        )
    md.append("\nReach: `†` hand-set in features.toml, `*` derived from npm downloads, unmarked = per-score default.\n")
    md.append("## Reach estimates and their justification\n")
    for r in sorted(rows, key=lambda r: -r["reach"]):
        if r["reach_source"] in ("explicit", "override"):
            md.append(f"- **{r['id']}**: {r['reach']:.2f}. {r['reach_rationale']}")
    md.append("\n## Macro groups\n")
    md.append("Group usefulness is the cost-weighted mean of its features' linear scores.\n")
    md.append("| Group | Features | Src LOC | Non-src LOC | Distinct deps | Commits | PRs fix/feat/maint | Cost | Weighted U | Cost/U |")
    md.append("|---|--:|--:|--:|--:|--:|:-:|--:|--:|--:|")
    for g in group_rows:
        md.append(f"| {g['name']} (`{g['id']}`){' (maintainer-only)' if g['maintainer_only'] else ''} | {g['features']} | {fmt(g['src_loc'])} | {fmt(g['nonsrc_loc'])} | {g['n_deps']} | "
                  f"{g['churn_commits']} | {g['prs_fix']}/{g['prs_feature']}/{g['prs_maintenance']} | {fmt(g['cost'])} | {g['cost_weighted_usefulness']:.2f} | {fmt(g['cost_per_usefulness'])} |")
    md.append("\n## Dependencies per feature\n")
    md.append("Format: package (users across features; releases in 12 months; `stale` if unpublished for 2+ years, `deprecated`).\n")
    stale_days = int(weights.get("dependency_stale_days", 730))
    for r in sorted(rows, key=lambda r: -r["n_deps"]):
        if r["deps"]:
            parts = []
            for d in r["deps"]:
                info = npm_pkgs.get(d) or {}
                flag = " deprecated" if info.get("deprecated") else (" stale" if (info.get("days_since_last_publish") or 0) > stale_days else "")
                parts.append(f"{d} ({dep_users.get(d, 0)}; {info.get('releases_12mo', '?')}{flag})")
            md.append(f"- **{r['id']}** ({r['n_deps']}, {r['n_exclusive_deps']} exclusive, cost {fmt(r['deps_cost'])}): {', '.join(parts)}")
    md.append("\n## Internal import graph\n")
    md.append("Each feature with the features it imports from (import-statement counts). `strong` lists the importers that drive the `inherited` hypothesis (other group, not an aggregator, ≥ the configured number of import statements). Fan-out is the coupling term in cost.\n")
    for r in sorted(rows, key=lambda r: -r["fan_in"]):
        if r["imports_from"] or r["imported_by_raw"]:
            md.append(f"- **{r['id']}** imported by {r['fan_in']} (strong: {', '.join(r['imported_by']) or '-'}); imports from {r['fan_out']}: "
                      + ", ".join(f"{k} ({v})" for k, v in r["imports_from"].items()))
    md.append("\n## Coverage\n")
    md.append(f"Assigned source LOC: {fmt(coverage['assigned_src_loc'])} of {fmt(coverage['total_src_loc'])} "
              f"({100 * coverage['assigned_src_loc'] / max(coverage['total_src_loc'], 1):.1f}%). Unassigned files: {coverage['unassigned_files']}. "
              f"Same-specificity conflicts: {coverage['n_conflicts']}.\n")
    if coverage["unassigned_by_dir"]:
        md.append("Largest unassigned areas (all file kinds):\n")
        for k, v in coverage["unassigned_by_dir"].items():
            md.append(f"- {k}: {fmt(v)} lines")
    if coverage["unassigned_file_list"]:
        md.append("\nUnassigned files (largest first):\n")
        for path, loc in coverage["unassigned_file_list"][:60]:
            md.append(f"- {path} ({fmt(loc)})")
    if coverage["conflicts"]:
        md.append("\nConflicts (file → winner vs rivals):\n")
        for path, winner, rivals in coverage["conflicts"][:60]:
            md.append(f"- {path} → `{winner}` vs {', '.join('`%s`' % r for r in rivals)}")
    with open(os.path.join(HERE, "ranking.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(md) + "\n")

    write_quadrants(rows, meta, data["scanned_head"])


def write_quadrants(rows: list[dict], meta: dict, head: str) -> None:
    user_rows = [r for r in rows if not r["maintainer_only"]]
    median_cost = median_user_cost(rows)
    md = []
    md.append("# Decision views\n")
    md.append(f"Generated by `compute_metrics.py`, scanned at `{head}`. User-facing features only unless stated; maintainer-only features are listed separately.\n")

    def table(items, title, cols):
        md.append(f"## {title}\n")
        md.append("| " + " | ".join(c[0] for c in cols) + " |")
        md.append("|" + "|".join("--:" if c[2] else "---" for c in cols) + "|")
        for r in items:
            md.append("| " + " | ".join(c[1](r) for c in cols) + " |")
        md.append("")

    name = ("Feature", lambda r: f"{r['name']} (`{r['id']}`)", False)
    grp = ("Group", lambda r: r["group"], False)
    U = ("U", lambda r: str(r["usefulness"]), True)
    Uinh = ("U inh", lambda r: str(r["usefulness_inherited"]), True)
    cost = ("Cost", lambda r: fmt(r["cost"]), True)
    excl = ("Exclusive cost", lambda r: fmt(r["cost_exclusive"]), True)
    xdeps = ("Excl. deps", lambda r: f"{r['n_exclusive_deps']}/{r['n_deps']}", True)
    fix = ("Fix PRs (weighted)", lambda r: f"{r['prs_fix']} ({r['prs_fix_weighted']:g})", True)
    feat = ("Feature PRs", lambda r: str(r["prs_feature"]), True)
    issues = ("Issues", lambda r: "" if r["open_issues"] is None else str(r["open_issues"]), True)
    reach = ("Reach", lambda r: f"{r['reach']:.2f}", True)
    fanin = ("Fan-in (strong)", lambda r: f"{r['fan_in']} ({r['fan_in_strong']})", True)

    md.append(f"## 2×2: usefulness × cost (median user-facing cost = {fmt(median_cost)})\n")
    titles = {"simplify": "High usefulness (3–4), high cost: simplification candidates", "protect": "High usefulness (3–4), low cost: keep, protect",
              "sunset": "Low usefulness (1–2), high cost: sunset or externalise candidates", "cheap": "Low usefulness (1–2), low cost: cheap to keep, cheap to drop"}
    for q in ("simplify", "protect", "sunset", "cheap"):
        items = [r for r in user_rows if quadrant_of(r, median_cost) == q]
        md.append(f"### {titles[q]} ({len(items)})\n")
        for r in sorted(items, key=lambda r: -r["cost"]):
            md.append(f"- {r['name']} (`{r['id']}`): cost {fmt(r['cost'])}, U {r['usefulness']} (inherited {r['usefulness_inherited']}), reach {r['reach']:.2f}, fix PRs {r['prs_fix']}, excl. deps {r['n_exclusive_deps']}")
        md.append("")

    sunset = sorted([r for r in user_rows if r["usefulness"] <= 2], key=lambda r: -r["cost_exclusive"])
    table(sunset, "Sunset list: usefulness ≤ 2, ranked by exclusive cost (what removal actually saves)", [name, grp, U, Uinh, excl, xdeps, fix, feat, issues, reach])
    simp = sorted([r for r in user_rows if r["usefulness"] >= 3], key=lambda r: -(r["cost"] + 3 * r["cost_churn"]))
    table(simp[:30], "Simplification list: usefulness ≥ 3, ranked by cost with fix/maintenance churn weighted 3×",
          [name, grp, U, cost, ("Dep cost", lambda r: fmt(r["deps_cost"]), True), ("Stale deps", lambda r: str(len(r["deps_stale"])), True), fix,
           ("Maint PRs", lambda r: str(r["prs_maintenance"]), True), issues, fanin])
    internal = sorted([r for r in rows if r["maintainer_only"]], key=lambda r: -r["cost"])
    table(internal, "Maintainer-only tooling (not user-facing)", [name, grp, U, cost, xdeps, fix, feat, ("Commits", lambda r: str(r["churn_commits"]), True)])

    md.append("## Agreement across usefulness hypotheses\n")
    md.append("Rank under each hypothesis (1 = worst ratio). Features in the top 20 under every hypothesis are the stable backlog; a large spread means the verdict depends on how usefulness is modelled. `sensitivity.md` shows how the order changes when one weight or modelling choice changes.\n")
    md.append("| Feature | Group | U | Rank linear | Rank geometric | Rank reach | Rank inherited | Mean | Spread |")
    md.append("|---|---|:-:|--:|--:|--:|--:|--:|--:|")
    for r in sorted(rows, key=lambda r: r["rank_mean"])[:40]:
        md.append(f"| {r['name']} (`{r['id']}`) | {r['group']} | {r['usefulness']} | {r['rank_linear']} | {r['rank_geometric']} | {r['rank_reach']} | {r['rank_inherited']} | {r['rank_mean']:.1f} | {r['rank_spread']} |")
    stable = [r for r in rows if all(r[f"rank_{h}"] <= 20 for h in HYPOTHESES)]
    md.append(f"\nTop-20 under all four hypotheses ({len(stable)}): " + ", ".join(f"`{r['id']}`" for r in sorted(stable, key=lambda r: r["rank_mean"])))
    movers = sorted(rows, key=lambda r: -r["rank_spread"])[:12]
    md.append("\nLargest disagreements (rank spread): " + ", ".join(f"`{r['id']}` ({r['rank_spread']})" for r in movers))
    with open(os.path.join(HERE, "quadrants.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(md) + "\n")


# --------------------------------------------------------------------------- main


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-churn", action="store_true", help="skip the git log scan and PR attribution")
    ap.add_argument("--no-signals", action="store_true", help="ignore signals/*.json")
    args = ap.parse_args()
    cfg, groups, features = load_config()
    data = scan(cfg, groups, features, no_churn=args.no_churn, no_signals=args.no_signals)
    rows, group_rows = evaluate(data, cfg, groups, features)
    write_outputs(rows, group_rows, data, cfg)
    cov = data["coverage"]
    print(f"features: {len(rows)}  groups: {len(group_rows)}  head: {data['scanned_head']}")
    print(f"assigned src loc: {cov['assigned_src_loc']}  unassigned src loc: {cov['unassigned_src_loc']}  conflicts: {cov['n_conflicts']}")
    if data["churn_meta"].get("prs"):
        print("prs:", data["churn_meta"]["prs"])
    print("wrote metrics.json, metrics.csv, ranking.md, quadrants.md")


if __name__ == "__main__":
    main()
