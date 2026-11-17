#!/usr/bin/env python3
"""Build the feature-audit website: one self-contained HTML page with the data embedded.

Reads metrics.json, sensitivity.json (optional), features.toml and the signals, and writes

  site/index.html      a complete document to open locally
  site/artifact.html   the same page without the document skeleton, for publishing as an artifact

No build step, no server, no external requests beyond the Google Fonts stylesheet.

  python3 feature-audit/build_site.py
"""

from __future__ import annotations

import datetime as dt
import json
import os
import tomllib

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, "site")

# Same-purpose dependency clusters named in the report; only packages actually imported are kept.
CLUSTERS = [
    ("Globbing", ["glob", "globby", "tinyglobby", "fast-glob", "picomatch", "minimatch", "micromatch"]),
    ("Process spawning", ["execa", "cross-spawn", "tinyexec"]),
    ("JavaScript parsing", ["@babel/core", "@babel/parser", "@babel/traverse", "@babel/generator", "@babel/types", "oxc-parser", "acorn", "acorn-jsx", "acorn-walk", "recast", "jscodeshift", "typescript", "es-module-lexer", "cjs-module-lexer", "estree-walker", "esrap", "zimmerframe", "escodegen"]),
    ("UI primitives", ["react-aria", "react-aria-components", "react-stately", "@react-aria/overlays", "@react-stately/overlays", "@react-aria/live-announcer", "@radix-ui/react-scroll-area", "@radix-ui/react-slot", "@radix-ui/react-tabs", "react-popper-tooltip", "downshift"]),
    ("Schema validation", ["valibot", "zod", "@standard-schema/spec", "@valibot/to-json-schema"]),
    ("Colour utilities", ["polished", "color-convert", "react-colorful"]),
    ("Terminal output", ["picocolors", "ora", "@clack/prompts", "prompts", "npmlog", "wrap-ansi", "strip-ansi", "ansi-to-html"]),
    ("Deep equality / object utils", ["dequal", "deep-object-diff", "@ngard/tiny-isequal", "es-toolkit", "memoizerific"]),
]


def load_json(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def main() -> None:
    m = load_json(os.path.join(HERE, "metrics.json"))
    sens_path = os.path.join(HERE, "sensitivity.json")
    s = load_json(sens_path) if os.path.exists(sens_path) else {}
    with open(os.path.join(HERE, "features.toml"), "rb") as fh:
        cfg = tomllib.load(fh)
    globs = {f["id"]: {"include": f.get("include", []), "exclude": f.get("exclude", [])} for f in cfg["feature"]}

    def sig_meta(name: str) -> dict:
        p = os.path.join(HERE, "signals", name)
        if not os.path.exists(p):
            return {}
        d = load_json(p)
        return {k: d.get(k) for k in ("captured", "since", "ref", "closing_issues_captured", "source") if k in d}

    keep = ["id", "name", "group", "group_name", "maintainer_only", "usefulness", "usefulness_inherited", "rationale", "reach", "reach_source",
            "reach_rationale", "flags", "issue_labels", "npm", "npm_downloads", "open_issues", "files", "src_loc", "test_loc", "stories_loc",
            "fixture_loc", "nonsrc_loc", "deps", "exclusive_deps", "deps_stale", "n_deps", "n_exclusive_deps", "deps_cost", "exclusive_deps_cost",
            "internal_deps", "imports_from", "imported_by", "imported_by_raw", "fan_in", "fan_in_strong", "fan_out", "churn_commits", "prs_total",
            "prs_fix", "prs_fix_weighted", "prs_fix_severity", "prs_feature", "prs_maintenance", "prs_docs", "cost_code", "cost_churn", "cost",
            "cost_exclusive", "ratio_linear", "ratio_geometric", "ratio_reach", "ratio_inherited", "ratio_exclusive_geometric", "rank_linear",
            "rank_geometric", "rank_reach", "rank_inherited", "rank_mean", "rank_spread", "rank"]
    side = [f"{float(b):g}" for b in cfg.get("usefulness", {}).get("geometric_bases_side_by_side", [])]
    for b in side:
        keep += [f"ratio_geometric{b}", f"rank_geometric{b}"]
    features = []
    for r in m["features"]:
        row = {k: r.get(k) for k in keep}
        row["include"] = globs.get(r["id"], {}).get("include", [])
        row["exclude"] = globs.get(r["id"], {}).get("exclude", [])
        features.append(row)

    used_deps = sorted({d for f in features for d in f["deps"]})
    npm_pkgs = load_json(os.path.join(HERE, "signals", "npm-packages.json")).get("packages", {}) if os.path.exists(os.path.join(HERE, "signals", "npm-packages.json")) else {}
    pkg_info = {d: {k: v for k, v in (npm_pkgs.get(d) or {}).items() if k in ("releases_12mo", "days_since_last_publish", "deprecated", "unpacked_size_kb", "latest")} for d in used_deps}
    present = set(used_deps)
    clusters = [{"name": n, "packages": [p for p in pk if p in present]} for n, pk in CLUSTERS]
    clusters = [c for c in clusters if len(c["packages"]) >= 2]

    totals = {
        "src_loc": sum(f["src_loc"] for f in features),
        "nonsrc_loc": sum(f["nonsrc_loc"] for f in features),
        "features": len(features),
        "user_features": sum(1 for f in features if not f["maintainer_only"]),
        "groups": len(m["groups"]),
        "deps": len(used_deps),
        "stale_deps": len({d for f in features for d in f["deps_stale"]}),
        "cost": sum(f["cost"] for f in features),
        "cost_code": sum(f["cost_code"] for f in features),
        "cost_deps": sum(f["deps_cost"] for f in features),
        "cost_churn": sum(f["cost_churn"] for f in features),
    }
    data = {
        "meta": {**{k: m["meta"].get(k) for k in ("commit", "captured", "scanned_head", "churn_since", "scan_roots")},
                 "generated": dt.datetime.now().strftime("%Y-%m-%d %H:%M"), "weights": m["meta"].get("weights", {}),
                 "usefulness": m["meta"].get("usefulness", {}), "churn_config": m["meta"].get("churn_config", {}), "churn": m["meta"].get("churn", {}),
                 "signals": {"npm_downloads": sig_meta("npm-downloads-last-month.json"), "issues": sig_meta("github-open-issues-by-label.json"),
                             "prs": sig_meta("github-merged-prs.json"), "npm_packages": sig_meta("npm-packages.json")},
                 "side_bases": side, "totals": totals},
        "groups": m["groups"],
        "features": features,
        "dependency_users": m.get("dependency_users", {}),
        "pkg_info": pkg_info,
        "clusters": clusters,
        "sensitivity": {"one_at_a_time": s.get("one_at_a_time", [])} if s else None,
    }
    payload = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    body = TEMPLATE.replace("__DATA__", payload)
    os.makedirs(SITE, exist_ok=True)
    with open(os.path.join(SITE, "artifact.html"), "w", encoding="utf-8") as fh:
        fh.write(body)
    full = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + "</head>\n<body>\n" if False else
            '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<style>[hidden]{display:none!important}body{margin:0}</style>\n</head>\n<body>\n' + body + "\n</body>\n</html>\n")
    with open(os.path.join(SITE, "index.html"), "w", encoding="utf-8") as fh:
        fh.write(full)
    print(f"wrote site/index.html ({len(full) // 1024} KB) and site/artifact.html; {len(features)} features, {len(used_deps)} deps, sensitivity {'yes' if s else 'no'}")


TEMPLATE = r"""<title>Storybook Feature Audit</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spectral:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: a single 1040px column; sticky filter bar + tab strip; a right-hand drawer for feature detail. */
:root {
  --surface:#FAF9F7; --ink:#1B1E22; --ink-2:#4A5058; --ink-3:#8A9098;
  --line:#E4E1DB; --card:#FFFFFF; --wash:#F1EFEA; --focus:#1B1E22;
  --font-body:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
  --font-display:Spectral,Georgia,"Times New Roman",serif;
  --font-mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  /* chart roles (validated palette; see README) */
  --c-code:#2a78d6; --c-deps:#eb6834; --c-churn:#1baf7a;
  --u1:#86b6ef; --u2:#5598e7; --u3:#2a78d6; --u4:#184f95;
  --bar:#2a78d6; --bar-dim:#c3c2b7;
  --grid:#e1e0d9; --axis:#c3c2b7; --muted:#898781;
  --good:#006300; --warn:#B7791F; --critical:#B4232A;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --surface:#16181C; --ink:#E8E6E1; --ink-2:#AFB4BB; --ink-3:#767C85;
  --line:#2C2F35; --card:#1D2025; --wash:#22252B; --focus:#E8E6E1;
  --c-code:#3987e5; --c-deps:#d95926; --c-churn:#199e70;
  --u1:#184f95; --u2:#2a78d6; --u3:#5598e7; --u4:#86b6ef;
  --bar:#3987e5; --bar-dim:#383835;
  --grid:#2c2c2a; --axis:#383835; --muted:#898781;
  --good:#3AA46F; --warn:#D9A441; --critical:#D96B70;
  color-scheme: dark;
} }
:root[data-theme="dark"] {
  --surface:#16181C; --ink:#E8E6E1; --ink-2:#AFB4BB; --ink-3:#767C85;
  --line:#2C2F35; --card:#1D2025; --wash:#22252B; --focus:#E8E6E1;
  --c-code:#3987e5; --c-deps:#d95926; --c-churn:#199e70;
  --u1:#184f95; --u2:#2a78d6; --u3:#5598e7; --u4:#86b6ef;
  --bar:#3987e5; --bar-dim:#383835;
  --grid:#2c2c2a; --axis:#383835; --muted:#898781;
  --good:#3AA46F; --warn:#D9A441; --critical:#D96B70;
  color-scheme: dark;
}
* { box-sizing:border-box; }
::selection { background:var(--ink); color:var(--surface); }
body { background:var(--surface); color:var(--ink); margin:0; font:16px/1.6 var(--font-body); }
main { max-width:1040px; margin:0 auto; padding-block:40px 96px; padding-inline:24px; }
h1,h2,h3 { font-family:var(--font-display); text-wrap:balance; line-height:1.2; }
h1 { font-size:2.1rem; font-weight:700; margin:8px 0 4px; }
h2 { font-size:1.35rem; font-weight:600; margin:36px 0 10px; }
h3 { font-size:1.05rem; font-weight:600; margin:28px 0 6px; }
p { margin:8px 0; }
a { color:inherit; }
.eyebrow { font-size:.72rem; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-3); font-weight:600; }
.lede { color:var(--ink-2); max-width:68ch; }
.mono, .num { font-family:var(--font-mono); font-variant-numeric:tabular-nums; font-size:.86em; }
.muted { color:var(--ink-3); }
.small { font-size:.85rem; }
.topbar { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; }
button { font:inherit; color:inherit; }
button:focus-visible, a:focus-visible, [tabindex]:focus-visible, input:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.ghost { font:600 .8rem/1.4 var(--font-body); color:var(--ink-2); background:none; border:1px solid var(--line); border-radius:8px; padding:5px 10px; cursor:pointer; }
.ghost:hover { background:var(--card); }

/* tiles */
.tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; margin:22px 0 0; }
.tile { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px 14px; min-width:0; }
.tile .label { font-size:.78rem; color:var(--ink-3); font-weight:600; }
.tile .value { font-size:1.6rem; font-weight:600; line-height:1.2; margin-top:2px; }
.tile .sub { font-size:.78rem; color:var(--ink-2); margin-top:2px; }

/* filter bar + tabs */
.filterbar { display:flex; flex-direction:column; gap:10px; margin:22px 0 0; padding:12px 14px; background:var(--wash); border:1px solid var(--line); border-radius:12px;
  position:sticky; top:env(safe-area-inset-top, 0px); z-index:30; box-shadow:0 6px 18px rgba(0,0,0,.08); }
.fbrow { display:flex; flex-wrap:wrap; gap:8px 14px; align-items:center; }
.select { display:inline-flex; align-items:center; gap:7px; font-size:.72rem; font-weight:600; letter-spacing:.07em; text-transform:uppercase; color:var(--ink-3); }
.chips { display:flex; flex-wrap:wrap; gap:6px; }
.chip { display:inline-flex; align-items:center; gap:7px; font:600 .8rem/1.3 var(--font-body); color:var(--ink-2); background:var(--card); border:1px solid var(--line); border-radius:99px; padding:4px 11px; cursor:pointer; }
.chip[aria-pressed="false"] { opacity:.42; }
.seg { display:inline-flex; flex-wrap:wrap; }
.seg button { font:600 .78rem/1.3 var(--font-body); color:var(--ink-2); background:var(--card); border:1px solid var(--line); padding:4px 10px; cursor:pointer; white-space:nowrap; margin-left:-1px; }
.seg button:first-child { border-radius:7px 0 0 7px; margin-left:0; }
.seg button:last-child { border-radius:0 7px 7px 0; }
.seg button[aria-pressed="true"] { color:var(--surface); background:var(--ink); border-color:var(--ink); position:relative; z-index:1; }
.search { font:inherit; font-size:.9rem; color:var(--ink); background:var(--card); border:1px solid var(--line); border-radius:8px; padding:5px 10px; min-width:180px; }
.tabs { display:flex; gap:2px; border-bottom:1px solid var(--line); margin:22px 0 0; overflow-x:auto; position:sticky; top:var(--tabstop, 150px); z-index:29; background:var(--surface); }
.tab { font:600 .92rem/1.4 var(--font-body); color:var(--ink-2); background:none; border:none; border-bottom:2px solid transparent; padding:9px 14px; cursor:pointer; white-space:nowrap; }
.tab[aria-selected="true"] { color:var(--ink); border-bottom-color:var(--ink); }
.panel { padding-top:8px; }

/* charts */
figure { margin:14px 0 0; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px 10px; min-width:0; }
figure h3 { margin:0 0 2px; }
figcaption { font-size:.8rem; color:var(--ink-3); margin-bottom:10px; max-width:80ch; }
.legend { display:flex; gap:6px 16px; flex-wrap:wrap; font-size:.8rem; color:var(--ink-2); margin:4px 0 8px; }
.legend .key { display:inline-flex; align-items:center; gap:6px; }
.sw { display:inline-block; width:12px; height:12px; border-radius:3px; }
.dot { display:inline-block; width:10px; height:10px; border-radius:50%; }
svg { display:block; width:100%; height:auto; max-width:100%; font-family:var(--font-body); }
svg text { fill:var(--ink-2); font-size:12px; }
svg .axis-label { fill:var(--muted); font-size:11px; }
svg .mono-label { font-family:var(--font-mono); font-size:11px; font-variant-numeric:tabular-nums; }
svg .grid { stroke:var(--grid); stroke-width:1; }
svg .baseline { stroke:var(--axis); stroke-width:1; }
svg .hit { fill:transparent; cursor:pointer; }
svg .seg-code { fill:var(--c-code); } svg .seg-deps { fill:var(--c-deps); } svg .seg-churn { fill:var(--c-churn); }
svg .mark { cursor:pointer; }
svg .mark:hover, svg .mark:focus { filter:brightness(1.12); }
svg .ring { fill:var(--card); }
.table-toggle { font:600 .78rem/1.3 var(--font-body); color:var(--ink-2); background:none; border:1px solid var(--line); border-radius:8px; padding:4px 10px; cursor:pointer; margin-top:8px; }
.table-toggle:hover { background:var(--wash); }

/* tables */
.tablewrap { overflow-x:auto; margin-top:10px; border:1px solid var(--line); border-radius:12px; background:var(--card); }
table { border-collapse:collapse; width:100%; font-size:.86rem; }
th, td { padding:7px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
th { font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-3); font-weight:600; white-space:nowrap; position:sticky; top:0; background:var(--card); }
th.sortable { cursor:pointer; user-select:none; }
th.sortable[aria-sort="descending"]::after { content:" ▾"; } th.sortable[aria-sort="ascending"]::after { content:" ▴"; }
td.num, th.num { text-align:right; }
tr.row { cursor:pointer; }
tr.row:hover td { background:var(--wash); }
.fname { font-weight:600; }
.fid { font-family:var(--font-mono); font-size:.75rem; color:var(--ink-3); }
.pill { display:inline-block; font:600 .72rem/1.3 var(--font-body); padding:2px 8px; border-radius:99px; border:1px solid var(--line); color:var(--ink-2); white-space:nowrap; }
.pill.u { border-color:transparent; color:var(--card); }
.pill.u4 { background:var(--u4); } .pill.u3 { background:var(--u3); } .pill.u2 { background:var(--u2); } .pill.u1 { background:var(--u1); }
:root[data-theme="dark"] .pill.u1, :root[data-theme="dark"] .pill.u2 { color:var(--ink); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .pill.u1, :root:not([data-theme="light"]) .pill.u2 { color:var(--ink); } }
.status { display:inline-flex; align-items:center; gap:5px; font-size:.78rem; font-weight:600; }
.status.critical { color:var(--critical); } .status.warn { color:var(--warn); } .status.good { color:var(--good); }
.inbar { display:inline-block; height:6px; background:var(--bar); border-radius:0 3px 3px 0; vertical-align:middle; }
.inbar-track { display:inline-block; width:90px; height:6px; background:var(--wash); border-radius:3px; vertical-align:middle; margin-right:6px; }

/* lists & cards */
.cols { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:12px; margin-top:12px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px 16px; min-width:0; }
.card h3 { margin:0 0 6px; }
.card ol, .card ul { margin:6px 0 0; padding-left:20px; }
.card li { margin:4px 0; }
.deflist { display:grid; grid-template-columns:minmax(150px, max-content) 1fr; gap:8px 20px; margin:10px 0; font-size:.9rem; color:var(--ink-2); align-items:baseline; }
.deflist dt { white-space:nowrap; color:var(--ink-3); }
.deflist dd { margin:0; min-width:0; }
.deflist b { color:var(--ink); }
.statsbox { background:var(--wash); border:1px solid var(--line); border-radius:12px; padding:8px 18px; margin:12px 0; font-size:.88rem; color:var(--ink-2); }
.statsbox ul { margin:8px 0; padding-left:18px; } .statsbox li { margin:6px 0; } .statsbox b { color:var(--ink); }
code { font-family:var(--font-mono); font-size:.85em; background:var(--wash); padding:1px 5px; border-radius:4px; }
pre { font-family:var(--font-mono); font-size:.8rem; background:var(--wash); border:1px solid var(--line); border-radius:8px; padding:10px 12px; overflow-x:auto; }
.linklike { background:none; border:none; padding:0; color:var(--ink); text-decoration:underline; text-underline-offset:3px; cursor:pointer; font:inherit; text-align:left; }
.chartwrap { overflow-x:auto; }
.chartwrap svg { min-width:720px; }

/* tooltip */
#tip { position:fixed; z-index:60; max-width:320px; background:var(--card); color:var(--ink); border:1px solid var(--line); border-radius:10px; padding:8px 11px; font-size:.82rem; box-shadow:0 8px 24px rgba(0,0,0,.18); pointer-events:none; }
#tip .t { font-weight:600; margin-bottom:2px; }
#tip .v { font-family:var(--font-mono); font-variant-numeric:tabular-nums; }
#tip .k { display:inline-block; width:12px; height:3px; border-radius:2px; vertical-align:middle; margin-right:6px; }

/* drawer */
#drawer { position:fixed; top:0; right:0; bottom:0; width:min(520px, 100%); background:var(--card); border-left:1px solid var(--line); box-shadow:-10px 0 30px rgba(0,0,0,.15); z-index:50; overflow-y:auto; padding:18px 22px 40px; padding-top:calc(18px + env(safe-area-inset-top, 0px)); }
#drawer .close { position:sticky; top:0; float:right; z-index:1; }
#drawer h2 { margin:6px 0 2px; font-size:1.3rem; }
#drawer .section { margin-top:16px; }
#drawer .section h3 { margin:0 0 4px; font-size:.95rem; }
.stack { display:flex; height:10px; border-radius:5px; overflow:hidden; background:var(--wash); margin:6px 0; }
.stack span { display:block; height:100%; margin-right:2px; }
.stack span:last-child { margin-right:0; }
.taglist { display:flex; flex-wrap:wrap; gap:6px; }
.tag { font-family:var(--font-mono); font-size:.74rem; background:var(--wash); border:1px solid var(--line); border-radius:6px; padding:1px 6px; }
.tag.stale { border-color:var(--warn); } .tag.deprecated { border-color:var(--critical); }
.tag.excl { border-style:dashed; }
@media (max-width: 640px) { main { padding-inline:16px; } h1 { font-size:1.7rem; } .deflist { grid-template-columns:1fr; } }
@media (prefers-reduced-motion: reduce) { * { transition:none !important; } }
</style>

<main>
<div class="topbar">
  <div>
    <span class="eyebrow">feature audit · maintenance cost × usefulness</span>
    <h1>Storybook Feature Audit</h1>
    <p class="lede mono" id="provenance"></p>
  </div>
  <div style="display:flex; gap:8px; align-items:center; padding-top:10px">
    <button class="ghost" id="themeToggle" type="button" aria-label="Toggle dark mode">Theme</button>
  </div>
</div>
<p class="lede">Every tracked source file in the monorepo is assigned to one of 101 features in 10 groups. Each feature's maintenance cost combines its code volume, its third-party dependencies (priced by release cadence and staleness) and its severity-weighted bug-fix and maintenance pull requests over twelve months. A usefulness score from 1 (low) to 4 (mission-critical), reviewed by the maintainers, and a reach estimate (share of installs) turn cost into cost-per-usefulness under four hypotheses.</p>

<div class="tiles" id="tiles"></div>

<div class="filterbar" id="filterbar">
  <div class="fbrow">
    <span class="select">Groups</span>
    <div class="chips" id="groupChips"></div>
    <button class="ghost" id="resetFilters" type="button">Reset</button>
  </div>
  <div class="fbrow">
    <span class="select">Usefulness scale</span>
    <div class="seg" id="hypSeg" role="group" aria-label="Usefulness hypothesis"></div>
    <label class="chip" style="cursor:pointer"><input type="checkbox" id="userOnly" checked style="margin:0 2px 0 0"> user-facing only</label>
    <input class="search" id="search" type="search" placeholder="Find a feature…" aria-label="Find a feature">
  </div>
</div>

<div class="tabs" role="tablist" aria-label="Sections" id="tabs">
  <button class="tab" role="tab" id="tab-overview" aria-controls="panel-overview" aria-selected="true">Overview</button>
  <button class="tab" role="tab" id="tab-features" aria-controls="panel-features" aria-selected="false" tabindex="-1">Features</button>
  <button class="tab" role="tab" id="tab-map" aria-controls="panel-map" aria-selected="false" tabindex="-1">Decision map</button>
  <button class="tab" role="tab" id="tab-sensitivity" aria-controls="panel-sensitivity" aria-selected="false" tabindex="-1">Sensitivity</button>
  <button class="tab" role="tab" id="tab-dependencies" aria-controls="panel-dependencies" aria-selected="false" tabindex="-1">Dependencies</button>
  <button class="tab" role="tab" id="tab-method" aria-controls="panel-method" aria-selected="false" tabindex="-1">Method</button>
</div>

<section class="panel" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
  <h2>Where the cost sits</h2>
  <figure>
    <h3>Maintenance cost by group</h3>
    <figcaption>Cost points per group, split into code (source lines plus a quarter of test and fixture lines), dependencies and churn (bug-fix and maintenance PRs). The number at the bar tip is the group's cost-weighted usefulness.</figcaption>
    <div class="legend" id="groupLegend"></div>
    <div class="chartwrap" id="groupBars"></div>
    <button class="table-toggle" type="button" data-toggle="groupTable">Show as table</button>
    <div class="tablewrap" id="groupTable" hidden></div>
  </figure>
  <h2>Highlights</h2>
  <div class="cols" id="highlights"></div>
  <h2>Reading guide</h2>
  <div class="statsbox">
    <ul>
      <li><b>Cost</b> is a maintenance-effort index, not money: one source line is one point; a dependency costs 150 plus one point per release in the last year, plus 150 if it is stale or deprecated; a bug-fix PR costs 120 times its severity multiplier and a maintenance PR 40.</li>
      <li><b>Usefulness</b> is 1 low, 2 medium, 3 high, 4 mission-critical. The scale picker above changes how much more a higher level is worth: linear treats 4 as twice 2; the 3× scale treats each level as three times the one below (1/3/9/27); 2× and 4× are the same idea with gentler and steeper steps; reach divides by the share of installs that use the feature; inherited lets infrastructure borrow the score of whatever depends on it.</li>
      <li><b>Cost ÷ usefulness</b> ranks features by how expensive they are for what they give. Rank 1 is the worst ratio. The <b>Decision map</b> splits the same data into four quadrants; <b>Sensitivity</b> shows how much the order changes when one weight or modelling choice changes.</li>
      <li>Click any feature, bar or dot for its full record: rationale, reach justification, dependencies, imports, pull requests and the paths it covers.</li>
    </ul>
  </div>
</section>

<section class="panel" id="panel-features" role="tabpanel" aria-labelledby="tab-features" hidden>
  <h2>All features</h2>
  <p class="small muted" id="featureCount"></p>
  <div class="tablewrap"><table id="featureTable"><thead></thead><tbody></tbody></table></div>
</section>

<section class="panel" id="panel-map" role="tabpanel" aria-labelledby="tab-map" hidden>
  <h2>Decision map</h2>
  <figure>
    <h3>Usefulness against cost</h3>
    <figcaption>Each dot is a user-facing feature: horizontal position is cost on a log scale, vertical band is the usefulness score, dot size is reach (share of installs). The vertical hairline is the median cost; features above it on the low-usefulness side are the ones to question, features on the high-usefulness side are the ones to simplify.</figcaption>
    <div class="legend" id="mapLegend"></div>
    <div class="chartwrap" id="scatter"></div>
    <button class="table-toggle" type="button" data-toggle="mapTable">Show as table</button>
    <div class="tablewrap" id="mapTable" hidden></div>
  </figure>
  <div class="cols" id="quadrantLists"></div>
</section>

<section class="panel" id="panel-sensitivity" role="tabpanel" aria-labelledby="tab-sensitivity" hidden>
  <h2>How stable are these rankings?</h2>
  <div id="sensIntro"></div>
  <h3>One knob at a time</h3>
  <p class="small muted">Each scenario changes one setting and re-evaluates the same scan. Columns: Spearman correlation of the 3×-scale ranking with the baseline (1.0 = identical order), the largest single rank move, the features that moved five or more places, and the user-facing features that change quadrant on the decision map.</p>
  <div class="tablewrap" id="oatTable"></div>
</section>

<section class="panel" id="panel-dependencies" role="tabpanel" aria-labelledby="tab-dependencies" hidden>
  <h2>Third-party dependencies</h2>
  <figure>
    <h3>Most widely used packages</h3>
    <figcaption>Number of features importing each package. Hubs are cheap to keep and expensive to swap.</figcaption>
    <div class="chartwrap" id="hubBars"></div>
  </figure>
  <div class="cols">
    <div class="card"><h3>Stale or deprecated</h3><p class="small muted">Not published for two years, or deprecated on npm, grouped by the feature that imports them.</p><div id="staleList"></div></div>
    <div class="card"><h3>Same job, several packages</h3><p class="small muted">Packages doing overlapping work across features. Consolidation candidates with a small blast radius.</p><div id="clusterList"></div></div>
  </div>
  <h3>Exclusive dependencies by feature</h3>
  <p class="small muted">Packages that only one feature imports. Removing that feature would remove them.</p>
  <div class="tablewrap" id="exclTable"></div>
</section>

<section class="panel" id="panel-method" role="tabpanel" aria-labelledby="tab-method" hidden>
  <h2>Method and provenance</h2>
  <div id="method"></div>
</section>
</main>

<aside id="drawer" hidden aria-label="Feature detail"></aside>
<div id="tip" role="tooltip" hidden></div>

<script id="data" type="application/json">__DATA__</script>
<script>
(function () {
"use strict";
var DATA = JSON.parse(document.getElementById("data").textContent);
var F = DATA.features, G = DATA.groups, META = DATA.meta;
var byId = {}; F.forEach(function (f) { byId[f.id] = f; });
var groupName = {}; G.forEach(function (g) { groupName[g.id] = g.name; });
var $ = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };
var el = function (id) { return document.getElementById(id); };
var fmt = function (n, d) { if (n == null || isNaN(n)) return ""; return Number(n).toLocaleString("en-US", { maximumFractionDigits: d == null ? 0 : d }); };
var compact = function (n) { if (n == null) return ""; if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M"; if (Math.abs(n) >= 1e4) return Math.round(n / 1e3) + "k"; if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "k"; return fmt(n); };
var pct = function (x) { return Math.round(x * 100) + "%"; };
var text = function (tag, cls, content) { var e = document.createElement(tag); if (cls) e.className = cls; if (content != null) e.textContent = content; return e; };
var svgEl = function (tag, attrs) { var e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; };
var HYPS = [["linear", "linear"], ["geometric", "3× (default)"], ["geometric2", "2×"], ["geometric4", "4×"], ["reach", "reach"], ["inherited", "inherited"]];
HYPS = HYPS.filter(function (h) { return F[0]["ratio_" + h[0]] != null; });
var state = { groups: {}, hyp: "geometric", userOnly: true, search: "" };
G.forEach(function (g) { state.groups[g.id] = true; });
try { var t = localStorage.getItem("fa-theme"); if (t) document.documentElement.setAttribute("data-theme", t); } catch (e) {}

// ---------- provenance & tiles
var T = META.totals;
el("provenance").textContent = "map " + META.commit + " · scanned " + META.scanned_head + " · PRs since " + META.churn_since + " · generated " + META.generated;
var tiles = [
  ["Source lines", compact(T.src_loc), fmt(T.nonsrc_loc) + " lines of tests & fixtures"],
  ["Features", T.features, T.user_features + " user-facing · " + T.groups + " groups"],
  ["Third-party packages", T.deps, T.stale_deps + " stale or deprecated"],
  ["Bug-fix PRs, 12 months", (META.churn.prs && META.churn.prs.by_category && META.churn.prs.by_category.fix) || "", (META.churn.prs ? META.churn.prs.counted + " labelled PRs counted" : "")],
  ["Cost points", compact(T.cost), pct(T.cost_code / T.cost) + " code · " + pct(T.cost_deps / T.cost) + " deps · " + pct(T.cost_churn / T.cost) + " churn"]
];
tiles.forEach(function (t) { var d = text("div", "tile"); d.appendChild(text("div", "label", t[0])); d.appendChild(text("div", "value", String(t[1]))); d.appendChild(text("div", "sub", t[2])); el("tiles").appendChild(d); });

// ---------- theme
el("themeToggle").addEventListener("click", function () {
  var root = document.documentElement, cur = root.getAttribute("data-theme");
  var sysDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  var next = cur ? (cur === "dark" ? "light" : "dark") : (sysDark ? "light" : "dark");
  root.setAttribute("data-theme", next);
  try { localStorage.setItem("fa-theme", next); } catch (e) {}
  renderAll();
});

// ---------- filters
G.forEach(function (g) {
  var b = text("button", "chip", g.name); b.type = "button"; b.setAttribute("aria-pressed", "true"); b.dataset.group = g.id;
  b.addEventListener("click", function () { state.groups[g.id] = !state.groups[g.id]; b.setAttribute("aria-pressed", String(state.groups[g.id])); renderAll(); });
  el("groupChips").appendChild(b);
});
HYPS.forEach(function (h) {
  var b = text("button", "", h[1]); b.type = "button"; b.setAttribute("aria-pressed", String(h[0] === state.hyp)); b.dataset.hyp = h[0];
  b.addEventListener("click", function () { state.hyp = h[0]; $("#hypSeg button").forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.hyp === state.hyp)); }); renderAll(); });
  el("hypSeg").appendChild(b);
});
el("userOnly").addEventListener("change", function () { state.userOnly = el("userOnly").checked; renderAll(); });
el("search").addEventListener("input", function () { state.search = el("search").value.trim().toLowerCase(); renderFeatures(); });
el("resetFilters").addEventListener("click", function () {
  G.forEach(function (g) { state.groups[g.id] = true; }); $("#groupChips .chip").forEach(function (c) { c.setAttribute("aria-pressed", "true"); });
  state.userOnly = true; el("userOnly").checked = true; state.search = ""; el("search").value = ""; state.hyp = "geometric";
  $("#hypSeg button").forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.hyp === "geometric")); }); renderAll();
});
function visible() { return F.filter(function (f) { return state.groups[f.group] && (!state.userOnly || !f.maintainer_only); }); }
function hypLabel() { for (var i = 0; i < HYPS.length; i++) if (HYPS[i][0] === state.hyp) return HYPS[i][1]; return state.hyp; }

// ---------- tabs
var tabs = $(".tab");
function selectTab(i, focus) {
  tabs.forEach(function (t, j) { var on = i === j; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; el(t.getAttribute("aria-controls")).hidden = !on; });
  if (focus) tabs[i].focus();
}
tabs.forEach(function (t, i) {
  t.addEventListener("click", function () { selectTab(i, false); try { history.replaceState(null, "", "#" + t.id.replace("tab-", "")); } catch (e) {} });
  t.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") selectTab((i + 1) % tabs.length, true); if (e.key === "ArrowLeft") selectTab((i - 1 + tabs.length) % tabs.length, true); });
});
function syncSticky() { document.documentElement.style.setProperty("--tabstop", (el("filterbar").offsetHeight + (parseInt(getComputedStyle(document.documentElement).paddingTop) || 0)) + "px"); }
window.addEventListener("resize", syncSticky);
$("[data-toggle]").forEach(function (b) { b.addEventListener("click", function () { var t = el(b.dataset.toggle); t.hidden = !t.hidden; b.textContent = t.hidden ? "Show as table" : "Hide table"; }); });

// ---------- tooltip
var tip = el("tip");
function showTip(evt, lines) {
  tip.innerHTML = "";
  lines.forEach(function (l, i) { var d = text("div", i === 0 ? "t" : ""); if (l.key) { var k = text("span", "k"); k.style.background = l.key; d.appendChild(k); } var v = text("span", l.cls || "", l.text); d.appendChild(v); tip.appendChild(d); });
  tip.hidden = false; moveTip(evt);
}
function moveTip(evt) {
  var x = (evt.clientX != null ? evt.clientX : (evt.target.getBoundingClientRect().left + 12)), y = (evt.clientY != null ? evt.clientY : evt.target.getBoundingClientRect().top);
  var w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.min(x + 14, window.innerWidth - w - 8) + "px"; tip.style.top = (y + h + 24 > window.innerHeight ? y - h - 10 : y + 14) + "px";
}
function hideTip() { tip.hidden = true; }
function bindTip(node, linesFn) {
  node.addEventListener("pointerenter", function (e) { showTip(e, linesFn()); });
  node.addEventListener("pointermove", moveTip);
  node.addEventListener("pointerleave", hideTip);
  node.addEventListener("focus", function (e) { showTip(e, linesFn()); });
  node.addEventListener("blur", hideTip);
}

// ---------- helpers for tables
function makeTable(container, cols, rows, opts) {
  opts = opts || {};
  container.innerHTML = "";
  var table = document.createElement("table"), thead = document.createElement("thead"), tbody = document.createElement("tbody"), tr = document.createElement("tr");
  cols.forEach(function (c) { var th = text("th", c.num ? "num" : "", c.label); if (c.title) th.title = c.title; tr.appendChild(th); });
  thead.appendChild(tr); table.appendChild(thead); table.appendChild(tbody);
  rows.forEach(function (r) {
    var trr = document.createElement("tr");
    if (opts.rowId) { trr.className = "row"; trr.tabIndex = 0; trr.addEventListener("click", function () { openDrawer(opts.rowId(r)); }); trr.addEventListener("keydown", function (e) { if (e.key === "Enter") openDrawer(opts.rowId(r)); }); }
    cols.forEach(function (c) { var td = text("td", c.num ? "num" : ""); var v = c.get(r); if (v instanceof Node) td.appendChild(v); else td.textContent = v == null ? "" : v; trr.appendChild(td); });
    tbody.appendChild(trr);
  });
  container.appendChild(table);
}
function uPill(u) { var s = text("span", "pill u u" + u, String(u)); s.title = ["", "low", "medium", "high", "mission-critical"][u]; return s; }
function nameCell(f) { var d = document.createElement("div"); d.appendChild(text("div", "fname", f.name)); d.appendChild(text("div", "fid", f.id)); return d; }

// ---------- overview: group bars
var COMP = [["code", "Code", "--c-code"], ["deps", "Dependencies", "--c-deps"], ["churn", "Churn", "--c-churn"]];
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function renderGroupBars() {
  var legend = el("groupLegend"); legend.innerHTML = "";
  COMP.forEach(function (c) { var k = text("span", "key"); var sw = text("span", "sw"); sw.style.background = cssVar(c[2]); k.appendChild(sw); k.appendChild(text("span", "", c[1])); legend.appendChild(k); });
  var groups = G.filter(function (g) { return state.groups[g.id]; }).map(function (g) {
    var members = F.filter(function (f) { return f.group === g.id && (!state.userOnly || !f.maintainer_only); });
    var code = members.reduce(function (a, f) { return a + f.cost_code; }, 0), deps = members.reduce(function (a, f) { return a + f.deps_cost; }, 0), churn = members.reduce(function (a, f) { return a + f.cost_churn; }, 0);
    var cost = code + deps + churn, wu = cost ? members.reduce(function (a, f) { return a + f.usefulness * f.cost; }, 0) / cost : 0;
    return { g: g, code: code, deps: deps, churn: churn, cost: cost, wu: wu, n: members.length };
  }).filter(function (r) { return r.n > 0; }).sort(function (a, b) { return b.cost - a.cost; });
  var W = 960, labelW = 250, rowH = 30, padR = 60, H = groups.length * rowH + 30;
  var max = Math.max.apply(null, groups.map(function (r) { return r.cost; })) || 1;
  var x = function (v) { return labelW + v / max * (W - labelW - padR); };
  var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Maintenance cost by group, stacked by component" });
  [0.25, 0.5, 0.75, 1].forEach(function (t) { svg.appendChild(svgEl("line", { x1: x(max * t), x2: x(max * t), y1: 4, y2: H - 22, class: "grid" })); var tx = svgEl("text", { x: x(max * t), y: H - 6, "text-anchor": "middle", class: "axis-label mono-label" }); tx.textContent = compact(max * t); svg.appendChild(tx); });
  svg.appendChild(svgEl("line", { x1: x(0), x2: x(0), y1: 4, y2: H - 22, class: "baseline" }));
  groups.forEach(function (r, i) {
    var y = 8 + i * rowH;
    var lab = svgEl("text", { x: labelW - 10, y: y + 15, "text-anchor": "end" }); lab.textContent = r.g.name.length > 34 ? r.g.name.slice(0, 33) + "…" : r.g.name; svg.appendChild(lab);
    var cx = x(0);
    COMP.forEach(function (c) {
      var v = r[c[0]]; if (!v) return;
      var w = Math.max(0, x(v) - x(0) - 2);
      var rect = svgEl("rect", { x: cx, y: y, width: w, height: 20, class: "mark seg-" + c[0], tabindex: "0", rx: c[0] === "churn" ? 4 : 0 });
      bindTip(rect, function () { return [{ text: r.g.name }, { key: cssVar(c[2]), text: c[1] + ": " + fmt(v) + " points (" + pct(v / r.cost) + ")", cls: "v" }, { text: fmt(r.cost) + " total · weighted usefulness " + r.wu.toFixed(2) }]; });
      svg.appendChild(rect); cx += w + 2;
    });
    var val = svgEl("text", { x: x(r.cost) + 8, y: y + 15, class: "mono-label" }); val.textContent = r.wu.toFixed(2); svg.appendChild(val);
  });
  el("groupBars").innerHTML = ""; el("groupBars").appendChild(svg);
  makeTable(el("groupTable"), [
    { label: "Group", get: function (r) { return r.g.name; } }, { label: "Features", num: true, get: function (r) { return r.n; } },
    { label: "Code", num: true, get: function (r) { return fmt(r.code); } }, { label: "Dependencies", num: true, get: function (r) { return fmt(r.deps); } },
    { label: "Churn", num: true, get: function (r) { return fmt(r.churn); } }, { label: "Cost", num: true, get: function (r) { return fmt(r.cost); } },
    { label: "Weighted U", num: true, get: function (r) { return r.wu.toFixed(2); } }, { label: "Cost / U", num: true, get: function (r) { return fmt(r.wu ? r.cost / r.wu : 0); } }
  ], groups);
}

// ---------- overview: highlights
function renderHighlights() {
  var rows = visible(), key = "rank_" + state.hyp;
  var worst = rows.slice().sort(function (a, b) { return a[key] - b[key]; }).slice(0, 8);
  var fix = rows.slice().sort(function (a, b) { return b.prs_fix_weighted - a.prs_fix_weighted; }).slice(0, 8);
  var excl = rows.filter(function (f) { return f.n_exclusive_deps > 0; }).sort(function (a, b) { return b.exclusive_deps_cost - a.exclusive_deps_cost; }).slice(0, 8);
  var cont = el("highlights"); cont.innerHTML = "";
  function card(title, sub, items, render) { var c = text("div", "card"); c.appendChild(text("h3", "", title)); if (sub) c.appendChild(text("p", "small muted", sub)); var ol = document.createElement("ol"); items.forEach(function (f) { var li = document.createElement("li"); var b = text("button", "linklike", f.name); b.type = "button"; b.addEventListener("click", function () { openDrawer(f.id); }); li.appendChild(b); li.appendChild(text("span", "muted small", " " + render(f))); ol.appendChild(li); }); c.appendChild(ol); cont.appendChild(c); }
  card("Most expensive for what they give", "Worst cost ÷ usefulness on the " + hypLabel() + " scale.", worst, function (f) { return "U " + f.usefulness + " · " + fmt(f.cost) + " points"; });
  card("Where bug fixes landed", "Severity-weighted fix PRs in the last twelve months.", fix, function (f) { return f.prs_fix + " fixes (" + f.prs_fix_weighted + " weighted)"; });
  card("Largest exclusive dependency surface", "Packages nobody else imports; the saving if the feature went away.", excl, function (f) { return f.n_exclusive_deps + " of " + f.n_deps + " packages · " + fmt(f.exclusive_deps_cost) + " points"; });
}

// ---------- features table
var sortState = { key: "rank_geometric", dir: 1 };
function renderFeatures() {
  var key = state.hyp, rows = visible().filter(function (f) { return !state.search || (f.name + " " + f.id + " " + f.group_name).toLowerCase().indexOf(state.search) >= 0; });
  var cols = [
    { key: "rank_" + key, label: "Rank", num: true, title: "Rank by cost ÷ usefulness on the selected scale (1 = worst)", get: function (f) { return f["rank_" + key]; } },
    { key: "name", label: "Feature", get: function (f) { return nameCell(f); }, sortVal: function (f) { return f.name.toLowerCase(); } },
    { key: "group_name", label: "Group", get: function (f) { return f.group_name; }, sortVal: function (f) { return f.group_name; } },
    { key: "usefulness", label: "U", num: true, get: function (f) { return uPill(f.usefulness); } },
    { key: "reach", label: "Reach", num: true, get: function (f) { return f.reach.toFixed(2); } },
    { key: "src_loc", label: "Src LOC", num: true, get: function (f) { return fmt(f.src_loc); } },
    { key: "n_deps", label: "Deps (excl.)", num: true, get: function (f) { return f.n_deps + " (" + f.n_exclusive_deps + ")"; } },
    { key: "prs_fix_weighted", label: "Fix PRs (w.)", num: true, get: function (f) { return f.prs_fix + " (" + f.prs_fix_weighted + ")"; } },
    { key: "open_issues", label: "Issues", num: true, get: function (f) { return f.open_issues == null ? "" : f.open_issues; } },
    { key: "cost", label: "Cost", num: true, get: function (f) { var d = document.createElement("div"); var tr = text("span", "inbar-track"); var b = text("span", "inbar"); b.style.width = Math.max(2, Math.round(90 * f.cost / maxCost)) + "px"; tr.appendChild(b); d.appendChild(tr); d.appendChild(text("span", "num", fmt(f.cost))); return d; } },
    { key: "ratio_" + key, label: "Cost / U", num: true, get: function (f) { return fmt(f["ratio_" + key]); } }
  ];
  var maxCost = Math.max.apply(null, F.map(function (f) { return f.cost; }));
  if (!cols.some(function (c) { return c.key === sortState.key; })) sortState = { key: "rank_" + key, dir: 1 };
  var sc = cols.filter(function (c) { return c.key === sortState.key; })[0];
  rows.sort(function (a, b) { var va = sc.sortVal ? sc.sortVal(a) : a[sc.key], vb = sc.sortVal ? sc.sortVal(b) : b[sc.key]; if (va == null) va = -Infinity; if (vb == null) vb = -Infinity; return (va < vb ? -1 : va > vb ? 1 : 0) * sortState.dir; });
  var table = el("featureTable"), thead = table.querySelector("thead"), tbody = table.querySelector("tbody");
  thead.innerHTML = ""; tbody.innerHTML = "";
  var tr = document.createElement("tr");
  cols.forEach(function (c) { var th = text("th", "sortable" + (c.num ? " num" : ""), c.label); if (c.title) th.title = c.title; th.setAttribute("aria-sort", sortState.key === c.key ? (sortState.dir === 1 ? "ascending" : "descending") : "none"); th.addEventListener("click", function () { if (sortState.key === c.key) sortState.dir = -sortState.dir; else { sortState.key = c.key; sortState.dir = c.num ? -1 : 1; if (c.key.indexOf("rank_") === 0) sortState.dir = 1; } renderFeatures(); }); tr.appendChild(th); });
  thead.appendChild(tr);
  rows.forEach(function (f) { var trr = text("tr", "row"); trr.tabIndex = 0; trr.addEventListener("click", function () { openDrawer(f.id); }); trr.addEventListener("keydown", function (e) { if (e.key === "Enter") openDrawer(f.id); }); cols.forEach(function (c) { var td = text("td", c.num ? "num" : ""); var v = c.get(f); if (v instanceof Node) td.appendChild(v); else td.textContent = v == null ? "" : v; trr.appendChild(td); }); tbody.appendChild(trr); });
  el("featureCount").textContent = rows.length + " of " + F.length + " features shown · sorted by " + sc.label + " · scale: " + hypLabel();
}

// ---------- decision map
function renderScatter() {
  var rows = visible().filter(function (f) { return !f.maintainer_only; });
  var all = F.filter(function (f) { return !f.maintainer_only; }), costs = all.map(function (f) { return f.cost; }).sort(function (a, b) { return a - b; });
  var median = costs[Math.floor(costs.length / 2)];
  var W = 960, H = 400, padL = 56, padR = 24, padT = 18, padB = 44;
  var lo = Math.min.apply(null, all.map(function (f) { return f.cost; })) * 0.9, hi = Math.max.apply(null, all.map(function (f) { return f.cost; })) * 1.1;
  var x = function (c) { return padL + (Math.log(c) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)) * (W - padL - padR); };
  var bandH = (H - padT - padB) / 4, y = function (u, j) { return padT + (4 - u) * bandH + bandH / 2 + j; };
  var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Usefulness against cost, one dot per feature" });
  [1, 2, 3, 4].forEach(function (u) { svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: padT + (4 - u + 1) * bandH, y2: padT + (4 - u + 1) * bandH, class: "grid" })); var t = svgEl("text", { x: padL - 10, y: y(u, 4), "text-anchor": "end" }); t.textContent = ["", "low", "medium", "high", "critical"][u]; svg.appendChild(t); });
  var ticks = [500, 1000, 2000, 5000, 10000, 20000, 50000]; ticks.forEach(function (v) { if (v < lo || v > hi) return; svg.appendChild(svgEl("line", { x1: x(v), x2: x(v), y1: padT, y2: H - padB, class: "grid" })); var t = svgEl("text", { x: x(v), y: H - padB + 16, "text-anchor": "middle", class: "axis-label mono-label" }); t.textContent = compact(v); svg.appendChild(t); });
  var xl = svgEl("text", { x: (padL + W - padR) / 2, y: H - 6, "text-anchor": "middle", class: "axis-label" }); xl.textContent = "maintenance cost (log scale) →"; svg.appendChild(xl);
  svg.appendChild(svgEl("line", { x1: x(median), x2: x(median), y1: padT, y2: H - padB, class: "baseline", "stroke-dasharray": "0" }));
  var ml = svgEl("text", { x: x(median) + 6, y: padT + 12, class: "axis-label" }); ml.textContent = "median cost " + compact(median); svg.appendChild(ml);
  svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: padT + 2 * bandH, y2: padT + 2 * bandH, class: "baseline" }));
  var uColor = { 1: cssVar("--u1"), 2: cssVar("--u2"), 3: cssVar("--u3"), 4: cssVar("--u4") };
  var seeded = function (s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000; return h / 1000; };
  var sortedRows = rows.slice().sort(function (a, b) { return b.reach - a.reach; });
  var labelled = rows.filter(function (f) { return (f.usefulness <= 2 && f.cost >= median) || (f.usefulness >= 3 && f.cost >= median * 3); }).sort(function (a, b) { return b.cost - a.cost; }).slice(0, 14);
  sortedRows.forEach(function (f) {
    var r = 5 + Math.sqrt(f.reach) * 10, jitter = (seeded(f.id) - 0.5) * (bandH - 2 * r - 6);
    var cx = x(f.cost), cy = y(f.usefulness, jitter);
    var g = svgEl("g", { class: "mark", tabindex: "0", role: "button", "aria-label": f.name + ", usefulness " + f.usefulness + ", cost " + fmt(f.cost) });
    g.appendChild(svgEl("circle", { cx: cx, cy: cy, r: Math.max(r + 8, 12), class: "hit" }));
    g.appendChild(svgEl("circle", { cx: cx, cy: cy, r: r + 2, class: "ring" }));
    g.appendChild(svgEl("circle", { cx: cx, cy: cy, r: r, fill: uColor[f.usefulness] }));
    if (labelled.indexOf(f) >= 0) { var t = svgEl("text", { x: cx + r + 5, y: cy + 4, class: "axis-label" }); t.textContent = f.name.length > 28 ? f.name.slice(0, 27) + "…" : f.name; g.appendChild(t); }
    bindTip(g, function () { return [{ text: f.name }, { text: fmt(f.cost) + " cost points · usefulness " + f.usefulness + " · reach " + pct(f.reach), cls: "v" }, { text: f.group_name + " · " + f.prs_fix + " fix PRs · " + f.n_deps + " deps (" + f.n_exclusive_deps + " exclusive)" }]; });
    g.addEventListener("click", function () { openDrawer(f.id); }); g.addEventListener("keydown", function (e) { if (e.key === "Enter") openDrawer(f.id); });
    svg.appendChild(g);
  });
  el("scatter").innerHTML = ""; el("scatter").appendChild(svg);
  var legend = el("mapLegend"); legend.innerHTML = "";
  [4, 3, 2, 1].forEach(function (u) { var k = text("span", "key"); var d = text("span", "dot"); d.style.background = uColor[u]; k.appendChild(d); k.appendChild(text("span", "", ["", "low (1)", "medium (2)", "high (3)", "mission-critical (4)"][u])); legend.appendChild(k); });
  var k2 = text("span", "key muted", "dot size = reach"); legend.appendChild(k2);
  makeTable(el("mapTable"), [
    { label: "Feature", get: function (f) { return nameCell(f); } }, { label: "U", num: true, get: function (f) { return f.usefulness; } },
    { label: "Reach", num: true, get: function (f) { return f.reach.toFixed(2); } }, { label: "Cost", num: true, get: function (f) { return fmt(f.cost); } },
    { label: "Quadrant", get: function (f) { return quadrantName(f, median); } }
  ], rows.slice().sort(function (a, b) { return b.cost - a.cost; }), { rowId: function (f) { return f.id; } });
  var cont = el("quadrantLists"); cont.innerHTML = "";
  var quads = [["sunset", "Low usefulness, high cost", "Candidates to question: what would removal or externalisation save?"], ["simplify", "High usefulness, high cost", "Essential and expensive: the simplification targets."], ["protect", "High usefulness, low cost", "Keep and protect."], ["cheap", "Low usefulness, low cost", "Cheap to keep, cheap to drop."]];
  quads.forEach(function (q) {
    var items = rows.filter(function (f) { return quadrantKey(f, median) === q[0]; }).sort(function (a, b) { return b.cost - a.cost; });
    var c = text("div", "card"); c.appendChild(text("h3", "", q[1] + " (" + items.length + ")")); c.appendChild(text("p", "small muted", q[2]));
    var ol = document.createElement("ol"); items.forEach(function (f) { var li = document.createElement("li"); var b = text("button", "linklike", f.name); b.type = "button"; b.addEventListener("click", function () { openDrawer(f.id); }); li.appendChild(b); li.appendChild(text("span", "muted small", " " + fmt(f.cost) + " · U " + f.usefulness)); ol.appendChild(li); }); c.appendChild(ol); cont.appendChild(c);
  });
}
function quadrantKey(f, median) { var hu = f.usefulness >= 3, hc = f.cost >= median; return hu ? (hc ? "simplify" : "protect") : (hc ? "sunset" : "cheap"); }
function quadrantName(f, median) { return { simplify: "simplify", protect: "protect", sunset: "question", cheap: "cheap" }[quadrantKey(f, median)]; }

// ---------- sensitivity
function renderSensitivity() {
  var S = DATA.sensitivity, intro = el("sensIntro"); intro.innerHTML = "";
  if (!S || !S.one_at_a_time || !S.one_at_a_time.length) { intro.appendChild(text("p", "muted", "No sensitivity run found. Run sensitivity.py and rebuild the site.")); el("oatTable").innerHTML = ""; return; }
  var oat = S.one_at_a_time;
  var weightRows = oat.filter(function (o) { return o.scenario.indexOf("×") >= 0; });
  var minW = weightRows.length ? Math.min.apply(null, weightRows.map(function (o) { return o.spearman_geometric; })) : null;
  var lowest = oat.slice().sort(function (a, b) { return a.spearman_geometric - b.spearman_geometric; })[0];
  var flipScen = {}; oat.forEach(function (o) { (o.quadrant_flips || []).forEach(function (id) { (flipScen[id] = flipScen[id] || []).push(o.scenario); }); });
  var flips = Object.keys(flipScen).map(function (id) { return byId[id]; }).filter(Boolean).sort(function (a, b) { return flipScen[b.id].length - flipScen[a.id].length; });
  var box = text("div", "statsbox"); var ul = document.createElement("ul");
  function li(node) { var l = document.createElement("li"); l.appendChild(node); ul.appendChild(l); }
  function names(list, suffix) { var sp = document.createElement("span"); list.forEach(function (f, i) { var b = text("button", "linklike", f.name); b.type = "button"; b.addEventListener("click", function () { openDrawer(f.id); }); sp.appendChild(b); if (suffix) sp.appendChild(text("span", "muted", " (" + suffix(f) + ")")); if (i < list.length - 1) sp.appendChild(document.createTextNode(", ")); }); if (!list.length) sp.textContent = "none"; return sp; }
  var l1 = document.createElement("span"); l1.appendChild(text("b", "", "Method")); l1.appendChild(document.createTextNode(": each scenario changes one weight or modelling choice and re-evaluates the same scan; Spearman compares the resulting 3×-scale order with the baseline, where 1.0 is an identical order.")); li(l1);
  if (minW !== null) { var l2 = document.createElement("span"); l2.appendChild(text("b", "", "Cost weights at ×0.5 and ×1.5")); l2.appendChild(document.createTextNode(": the order stays within Spearman " + minW.toFixed(3) + " of the baseline.")); li(l2); }
  var l3 = document.createElement("span"); l3.appendChild(text("b", "", "Largest reordering")); l3.appendChild(document.createTextNode(": " + lowest.scenario + " (Spearman " + lowest.spearman_geometric.toFixed(3) + ", largest move " + lowest.max_move + " places).")); li(l3);
  var l4 = document.createElement("span"); l4.appendChild(text("b", "", "Features that change quadrant in at least one scenario: ")); l4.appendChild(names(flips, function (f) { return flipScen[f.id].join(", "); })); li(l4);
  var l5 = document.createElement("span"); l5.appendChild(text("b", "", "Scores, not weights, decide the quadrants")); l5.appendChild(document.createTextNode(": the decision map splits usefulness between 2 and 3, so a feature scoring 2 or 3 with above-median cost changes quadrant with a one-step change of its score.")); li(l5);
  box.appendChild(ul); intro.appendChild(box);
  makeTable(el("oatTable"), [
    { label: "Scenario", get: function (o) { return o.scenario; } }, { label: "Spearman", num: true, get: function (o) { return o.spearman_geometric.toFixed(3); } },
    { label: "Max move", num: true, get: function (o) { return o.max_move; } },
    { label: "Movers (rank before → after)", get: function (o) { if (o.inherited_changes) return "inherited score changes: " + (o.inherited_changes.map(function (c) { return c[0] + " " + c[1] + "→" + c[2]; }).join(", ") || "none"); return o.movers.map(function (mv) { return (byId[mv[0]] ? byId[mv[0]].name : mv[0]) + " " + mv[1] + "→" + mv[2]; }).join(", ") || "–"; } },
    { label: "Quadrant flips", get: function (o) { return (o.quadrant_flips || []).map(function (id) { return byId[id] ? byId[id].name : id; }).join(", ") || "–"; } }
  ], oat);
}

// ---------- dependencies
function renderDependencies() {
  var DU = DATA.dependency_users, PI = DATA.pkg_info;
  var hubs = Object.keys(DU).map(function (k) { return [k, DU[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 20);
  var W = 960, labelW = 240, rowH = 22, H = hubs.length * rowH + 30, padR = 50, max = hubs[0] ? hubs[0][1] : 1;
  var x = function (v) { return labelW + v / max * (W - labelW - padR); };
  var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Most widely used packages" });
  svg.appendChild(svgEl("line", { x1: x(0), x2: x(0), y1: 4, y2: H - 22, class: "baseline" }));
  [10, 20, 30, 40, 50].forEach(function (v) { if (v > max) return; svg.appendChild(svgEl("line", { x1: x(v), x2: x(v), y1: 4, y2: H - 22, class: "grid" })); var t = svgEl("text", { x: x(v), y: H - 6, "text-anchor": "middle", class: "axis-label mono-label" }); t.textContent = v; svg.appendChild(t); });
  var bar = cssVar("--bar");
  hubs.forEach(function (h, i) {
    var y = 8 + i * rowH;
    var lab = svgEl("text", { x: labelW - 10, y: y + 12, "text-anchor": "end", class: "mono-label" }); lab.textContent = h[0]; svg.appendChild(lab);
    var rect = svgEl("rect", { x: x(0), y: y, width: Math.max(0, x(h[1]) - x(0)), height: 14, fill: bar, rx: 4, class: "mark", tabindex: "0" });
    var info = PI[h[0]] || {};
    bindTip(rect, function () { return [{ text: h[0] }, { text: h[1] + " features import it", cls: "v" }, { text: (info.releases_12mo != null ? info.releases_12mo + " releases in 12 months · " : "") + (info.days_since_last_publish != null ? "last publish " + info.days_since_last_publish + " days ago" : "") }]; });
    svg.appendChild(rect);
    var v = svgEl("text", { x: x(h[1]) + 6, y: y + 12, class: "mono-label" }); v.textContent = h[1]; svg.appendChild(v);
  });
  el("hubBars").innerHTML = ""; el("hubBars").appendChild(svg);
  var stale = el("staleList"); stale.innerHTML = "";
  var rows = visible().filter(function (f) { return f.deps_stale.length; }).sort(function (a, b) { return b.deps_stale.length - a.deps_stale.length; });
  rows.forEach(function (f) { var d = document.createElement("div"); d.style.margin = "8px 0"; var b = text("button", "linklike", f.name); b.type = "button"; b.addEventListener("click", function () { openDrawer(f.id); }); d.appendChild(b); var tl = text("div", "taglist"); f.deps_stale.forEach(function (p) { var info = PI[p] || {}; var t = text("span", "tag " + (info.deprecated ? "deprecated" : "stale"), p + (info.deprecated ? " · deprecated" : " · " + Math.round((info.days_since_last_publish || 0) / 365) + "y")); tl.appendChild(t); }); d.appendChild(tl); stale.appendChild(d); });
  if (!rows.length) stale.appendChild(text("p", "muted small", "None in the current selection."));
  var cl = el("clusterList"); cl.innerHTML = "";
  DATA.clusters.forEach(function (c) { var d = document.createElement("div"); d.style.margin = "8px 0"; d.appendChild(text("div", "fname small", c.name + " (" + c.packages.length + ")")); var tl = text("div", "taglist"); c.packages.forEach(function (p) { var t = text("span", "tag", p + " · " + (DU[p] || 0)); t.title = (DU[p] || 0) + " features"; tl.appendChild(t); }); d.appendChild(tl); cl.appendChild(d); });
  var ex = visible().filter(function (f) { return f.n_exclusive_deps; }).sort(function (a, b) { return b.exclusive_deps_cost - a.exclusive_deps_cost; });
  makeTable(el("exclTable"), [
    { label: "Feature", get: function (f) { return nameCell(f); } }, { label: "Exclusive / all", num: true, get: function (f) { return f.n_exclusive_deps + " / " + f.n_deps; } },
    { label: "Cost of exclusive deps", num: true, get: function (f) { return fmt(f.exclusive_deps_cost); } },
    { label: "Packages", get: function (f) { var tl = text("div", "taglist"); f.exclusive_deps.forEach(function (p) { tl.appendChild(text("span", "tag excl", p)); }); return tl; } }
  ], ex, { rowId: function (f) { return f.id; } });
}

// ---------- method
function renderMethod() {
  var w = META.weights, u = META.usefulness, c = META.churn_config, cont = el("method"); cont.innerHTML = "";
  function dl(pairs) { var d = text("dl", "deflist"); pairs.forEach(function (p) { d.appendChild(text("dt", "", p[0])); var dd = document.createElement("dd"); if (p[1] instanceof Node) dd.appendChild(p[1]); else dd.textContent = p[1]; d.appendChild(dd); }); return d; }
  cont.appendChild(text("h3", "", "What was measured"));
  cont.appendChild(text("p", "", "Every file tracked by git under " + (META.scan_roots || []).join(", ") + " with a JavaScript, TypeScript, Vue or Svelte extension was classified as source, test, stories, fixture or ignored (built output), and assigned to the feature whose path pattern matches it most specifically. Third-party dependencies are the packages a feature's source files import, excluding Node built-ins and workspace packages, counted only if installed. The feature-to-feature import graph is resolved from relative imports, storybook/* entry points and workspace packages."));
  cont.appendChild(text("h3", "", "Cost formula"));
  var pre = text("pre", "", "cost = src_loc\n     + " + w.test_loc + " × (test + stories + fixture loc)\n     + Σ deps [ " + w.dependency_base + " + " + w.dependency_per_release + " × min(releases_12mo, " + w.dependency_release_cap + ") + " + w.dependency_stale_penalty + " if unpublished ≥ " + w.dependency_stale_days + " days or deprecated ]\n     + " + w.fix_pr + " × Σ fix PRs × severity multiplier   (" + Object.keys(c.severity_multipliers || {}).map(function (k) { return k + " " + c.severity_multipliers[k] + "×"; }).join(", ") + ")\n     + " + w.maintenance_pr + " × maintenance PRs\n     + " + w.churn + " × raw commits + " + w.internal_fan_out + " × internal fan-out\n\nexclusive cost = the same with only the dependencies no other feature imports");
  cont.appendChild(pre);
  cont.appendChild(text("h3", "", "Usefulness hypotheses"));
  cont.appendChild(dl([
    ["linear", "The 1–4 score as is: mission-critical is worth twice medium."],
    ["3× (default)", "Each level is worth " + u.geometric_base + " times the level below: low 1, medium " + u.geometric_base + ", high " + Math.pow(u.geometric_base, 2) + ", mission-critical " + Math.pow(u.geometric_base, 3) + ". The base is the multiplier between adjacent levels; 2× and 4× show the same ranking with multipliers 2 (1/2/4/8) and 4 (1/4/16/64)."],
    ["reach", "Share of installs that exercise the feature: hand-set with a justification for in-core features, npm downloads of the feature's package divided by downloads of the storybook package for packaged ones, floored at " + u.reach_floor + "."],
    ["inherited", "The 3× score after each feature inherits the highest score of any feature in another group that imports it from at least " + u.inheritance_min_imports + " places, excluding aggregators that wire everything (" + (u.inheritance_exclude_importers || []).join(", ") + ") and maintainer-only code" + (u.inheritance_transitive ? ", propagated transitively." : ".")]
  ]));
  cont.appendChild(text("h3", "", "Churn"));
  var pr = META.churn.prs || {};
  cont.appendChild(text("p", "", "Merged pull requests since " + META.churn_since + " were collected from merge commits reachable from " + ((META.signals.prs || {}).ref || "origin/next") + " and categorised by label in this order: " + (c.categories || []).map(function (r) { return r.category + " (" + r.labels.join(", ") + ")"; }).join("; ") + ". Release PRs and PRs touching more than " + c.bulk_files_threshold + " files are dropped. A PR counts once for every feature whose files it touched. Fix PRs take the severity label of the PR itself, else of an issue they close." + (pr.counted ? " In this run: " + pr.counted + " PRs counted of " + pr.total + " (" + JSON.stringify(pr.by_category) + "); fix PRs by severity " + JSON.stringify(pr.fix_by_severity) + "." : "")));
  cont.appendChild(text("h3", "", "Signals and provenance"));
  var sg = META.signals;
  cont.appendChild(dl([
    ["Feature map", "drawn at commit " + META.commit + " (" + META.captured + "); scanned at " + META.scanned_head + "; site generated " + META.generated],
    ["npm downloads", "captured " + ((sg.npm_downloads || {}).captured || "–") + ", last-month totals per package from api.npmjs.org"],
    ["Open issues by label", "captured " + ((sg.issues || {}).captured || "–") + " via GitHub GraphQL"],
    ["Merged PRs", "captured " + ((sg.prs || {}).captured || "–") + "; closed issues attached " + ((sg.prs || {}).closing_issues_captured || "–")],
    ["Registry metadata", "captured " + ((sg.npm_packages || {}).captured || "–") + " from registry.npmjs.org for every third-party dependency"]
  ]));
  cont.appendChild(text("h3", "", "Caveats"));
  var ul = document.createElement("ul"); ["Lines of code measure size, not difficulty; severity-weighted fix PRs and open issues are the closest proxies for burden.", "A PR touching several features is counted once per feature, so group totals exceed the number of PRs.", "Every release of a dependency costs the same point; a Babel plugin bump and a Next.js major are priced alike.", "The inherited hypothesis can misfire when shared utilities are attributed to a feature (component manifests inherit from the React renderer's preset wiring).", "The reach hypothesis answers \"cost per user served\", so cheap packages for small communities get large ratios.", "Usefulness scores started as one reviewer's judgement; the fifteen that decided verdicts were re-scored by the maintainers and say so in their rationale.", "The documentation site (docs/) is not attributed to features and is a real, uncounted cost."].forEach(function (s) { ul.appendChild(text("li", "", s)); }); cont.appendChild(ul);
  cont.appendChild(text("h3", "", "Regenerate"));
  cont.appendChild(text("pre", "", "python3 -I feature-audit/fetch_pr_labels.py && python3 -I feature-audit/fetch_pr_issues.py\npython3 -I feature-audit/compute_metrics.py && python3 -I feature-audit/fetch_npm_metadata.py && python3 -I feature-audit/compute_metrics.py\npython3 -I feature-audit/sensitivity.py && python3 -I feature-audit/score_review.py\npython3 -I feature-audit/build_site.py"));
}

// ---------- drawer
function openDrawer(id) {
  var f = byId[id]; if (!f) return;
  var d = el("drawer"); d.innerHTML = "";
  var close = text("button", "ghost close", "Close"); close.type = "button"; close.addEventListener("click", closeDrawer); d.appendChild(close);
  d.appendChild(text("span", "eyebrow", f.group_name + (f.maintainer_only ? " · maintainer-only" : "")));
  d.appendChild(text("h2", "", f.name));
  d.appendChild(text("div", "fid", f.id));
  function section(title) { var s = text("div", "section"); s.appendChild(text("h3", "", title)); d.appendChild(s); return s; }
  var s1 = section("Verdict");
  var dl1 = text("dl", "deflist");
  function row(k, v) { dl1.appendChild(text("dt", "", k)); var dd = document.createElement("dd"); if (v instanceof Node) dd.appendChild(v); else dd.textContent = v; dl1.appendChild(dd); }
  var up = document.createElement("span"); up.appendChild(uPill(f.usefulness)); up.appendChild(document.createTextNode(" " + f.rationale)); row("Usefulness", up);
  if (f.usefulness_inherited !== f.usefulness) row("Inherited", f.usefulness_inherited + " via " + f.imported_by.join(", "));
  row("Reach", f.reach.toFixed(2) + " (" + f.reach_source + ")" + (f.reach_rationale ? " · " + f.reach_rationale : ""));
  var ranks = HYPS.map(function (h) { return h[1] + " " + f["rank_" + h[0]]; }).join(" · "); row("Rank (1 = worst)", ranks);
  if (f.flags && f.flags.length) row("Feature flags", f.flags.join(", "));
  s1.appendChild(dl1);
  var s2 = section("Cost: " + fmt(f.cost) + " points (exclusive " + fmt(f.cost_exclusive) + ")");
  var st = text("div", "stack"); [["cost_code", "--c-code"], ["deps_cost", "--c-deps"], ["cost_churn", "--c-churn"]].forEach(function (p) { var sp = document.createElement("span"); sp.style.width = (100 * f[p[0]] / f.cost) + "%"; sp.style.background = cssVar(p[1]); st.appendChild(sp); }); s2.appendChild(st);
  var dl2 = text("dl", "deflist");
  function r2(k, v) { dl2.appendChild(text("dt", "", k)); dl2.appendChild(text("dd", "", v)); }
  r2("Code", fmt(f.src_loc) + " source lines in " + f.files + " files; " + fmt(f.test_loc) + " test, " + fmt(f.stories_loc) + " stories, " + fmt(f.fixture_loc) + " fixture lines → " + fmt(f.cost_code) + " points");
  r2("Dependencies", f.n_deps + " packages (" + f.n_exclusive_deps + " exclusive, " + f.deps_stale.length + " stale or deprecated) → " + fmt(f.deps_cost) + " points");
  r2("Churn", f.prs_fix + " fix PRs (severity-weighted " + f.prs_fix_weighted + "), " + f.prs_maintenance + " maintenance, " + f.prs_feature + " feature, " + f.prs_docs + " docs; " + f.churn_commits + " commits → " + fmt(f.cost_churn) + " points");
  if (f.open_issues != null) r2("Open issues", f.open_issues + " across labels " + f.issue_labels.join(", "));
  if (f.npm && f.npm.length) r2("npm", f.npm.join(", ") + (f.npm_downloads ? " · " + fmt(f.npm_downloads) + " downloads last month" : ""));
  s2.appendChild(dl2);
  var s3 = section("Third-party packages"); var tl = text("div", "taglist");
  f.deps.forEach(function (p) { var info = DATA.pkg_info[p] || {}; var cls = "tag" + (f.exclusive_deps.indexOf(p) >= 0 ? " excl" : "") + (info.deprecated ? " deprecated" : (f.deps_stale.indexOf(p) >= 0 ? " stale" : "")); var t = text("span", cls, p); t.title = (DATA.dependency_users[p] || 0) + " features use it" + (info.releases_12mo != null ? "; " + info.releases_12mo + " releases in 12 months" : "") + (f.exclusive_deps.indexOf(p) >= 0 ? "; exclusive to this feature" : ""); tl.appendChild(t); });
  if (!f.deps.length) tl.appendChild(text("span", "muted small", "none"));
  s3.appendChild(tl); s3.appendChild(text("p", "small muted", "Dashed = exclusive to this feature. Amber border = not published for two years. Red border = deprecated."));
  var s4 = section("Internal imports");
  var dl4 = text("dl", "deflist");
  dl4.appendChild(text("dt", "", "Imports from")); dl4.appendChild(text("dd", "", Object.keys(f.imports_from).map(function (k) { return (byId[k] ? byId[k].name : k) + " (" + f.imports_from[k] + ")"; }).join(", ") || "–"));
  dl4.appendChild(text("dt", "", "Imported by")); dl4.appendChild(text("dd", "", f.imported_by_raw.map(function (k) { return byId[k] ? byId[k].name : k; }).join(", ") || "–"));
  if (f.internal_deps.length) { dl4.appendChild(text("dt", "", "Workspace packages")); dl4.appendChild(text("dd", "", f.internal_deps.join(", "))); }
  s4.appendChild(dl4);
  var s5 = section("Paths"); var pre = text("pre", "", f.include.join("\n") + (f.exclude.length ? "\n\nexcluding:\n" + f.exclude.join("\n") : "")); s5.appendChild(pre);
  d.hidden = false; d.scrollTop = 0; close.focus();
  try { history.replaceState(null, "", "#feature-" + f.id); } catch (e) {}
}
function closeDrawer() { el("drawer").hidden = true; try { history.replaceState(null, "", location.pathname); } catch (e) {} }
document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeDrawer(); hideTip(); } });

// ---------- boot
function renderAll() { renderGroupBars(); renderHighlights(); renderFeatures(); renderScatter(); renderSensitivity(); renderDependencies(); renderMethod(); syncSticky(); }
renderAll();
var hash = (location.hash || "").slice(1);
if (hash.indexOf("feature-") === 0) { openDrawer(hash.slice(8)); }
else { var idx = tabs.map(function (t) { return t.id.replace("tab-", ""); }).indexOf(hash); if (idx > 0) selectTab(idx, false); }
})();
</script>
"""


if __name__ == "__main__":
    main()
