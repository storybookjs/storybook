#!/usr/bin/env python3
"""Sensitivity analysis for the feature audit: how much does the ranking change when one modelling
choice changes?

Runs one repository scan (via compute_metrics.scan) and re-evaluates the model once per scenario:
every cost weight at x0.5 and x1.5, churn/dependency/test pricing switched off, coupling priced, the
geometric base at 2 and 4, inheritance one-hop instead of transitive. For each scenario it reports
the rank correlation with the baseline, the features that move the most, and the user-facing
features that change 2x2 quadrant.

Outputs sensitivity.md and sensitivity.json next to this script.

  python3 feature-audit/sensitivity.py [--no-churn]
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compute_metrics as cm  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
WEIGHT_KEYS = ["test_loc", "dependency_base", "dependency_per_release", "dependency_stale_penalty", "fix_pr", "maintenance_pr"]


def spearman(a: dict[str, int], b: dict[str, int]) -> float:
    ids = sorted(a)
    n = len(ids)
    if n < 2:
        return 1.0
    d2 = sum((a[i] - b[i]) ** 2 for i in ids)
    return 1 - 6 * d2 / (n * (n * n - 1))


def ranks_of(rows: list[dict], key: str) -> dict[str, int]:
    return {r["id"]: r[key] for r in rows}


def run_scenarios(data: dict, cfg: dict, groups: list[dict], features: list) -> list[dict]:
    """Evaluate the baseline and every one-at-a-time scenario against one scan."""
    base_rows, _ = cm.evaluate(data, cfg, groups, features)
    base = {r["id"]: r for r in base_rows}
    base_geo = ranks_of(base_rows, "rank_geometric")
    median_cost = cm.median_user_cost(base_rows)
    base_quadrant = {r["id"]: cm.quadrant_of(r, median_cost) for r in base_rows if not r["maintainer_only"]}

    oat = []
    scenarios: list[tuple[str, dict]] = []
    for k in WEIGHT_KEYS:
        for mult in (0.5, 1.5):
            scenarios.append((f"{k} ×{mult}", {"weights": {k: float(cfg["weights"].get(k, 0)) * mult}}))
    scenarios.append(("fix_pr = 0 (no churn pricing)", {"weights": {"fix_pr": 0, "maintenance_pr": 0}}))
    scenarios.append(("dependency_base = 0 (no dependency pricing)", {"weights": {"dependency_base": 0, "dependency_per_release": 0, "dependency_stale_penalty": 0}}))
    scenarios.append(("test_loc = 0 (ignore tests)", {"weights": {"test_loc": 0}}))
    scenarios.append(("internal_fan_out = 100", {"weights": {"internal_fan_out": 100}}))
    for name, ov in scenarios:
        rows, _ = cm.evaluate(data, cfg, groups, features, ov)
        geo = ranks_of(rows, "rank_geometric")
        moved = sorted(((abs(geo[i] - base_geo[i]), i) for i in geo), reverse=True)[:6]
        med = cm.median_user_cost(rows)
        flips = [r["id"] for r in rows if not r["maintainer_only"] and cm.quadrant_of(r, med) != base_quadrant[r["id"]]]
        oat.append({"scenario": name, "spearman_geometric": round(spearman(base_geo, geo), 3), "max_move": moved[0][0] if moved else 0,
                    "movers": [(i, base_geo[i], geo[i]) for d, i in moved if d >= 5], "quadrant_flips": flips})
    for gb in (2, 4):
        cfg2 = json.loads(json.dumps(cfg))
        cfg2["usefulness"]["geometric_base"] = gb
        rows, _ = cm.evaluate(data, cfg2, groups, features)
        geo = ranks_of(rows, "rank_geometric")
        moved = sorted(((abs(geo[i] - base_geo[i]), i) for i in geo), reverse=True)[:6]
        oat.append({"scenario": f"geometric_base = {gb}", "spearman_geometric": round(spearman(base_geo, geo), 3), "max_move": moved[0][0] if moved else 0,
                    "movers": [(i, base_geo[i], geo[i]) for d, i in moved if d >= 5], "quadrant_flips": []})
    cfg2 = json.loads(json.dumps(cfg))
    cfg2["usefulness"]["inheritance_transitive"] = False
    rows, _ = cm.evaluate(data, cfg2, groups, features)
    inh_changes = [(r["id"], base[r["id"]]["usefulness_inherited"], r["usefulness_inherited"]) for r in rows if r["usefulness_inherited"] != base[r["id"]]["usefulness_inherited"]]
    oat.append({"scenario": "inheritance one-hop", "spearman_geometric": 1.0, "max_move": 0, "movers": [], "quadrant_flips": [], "inherited_changes": inh_changes})
    return oat


def summarise(oat: list[dict]) -> dict:
    """The three facts the report leads with: the worst correlation among the ±50% weight scenarios,
    the scenario that reorders most, and every user-facing feature that changes quadrant anywhere."""
    weight_rows = [o for o in oat if "×" in o["scenario"]]
    lowest = min(oat, key=lambda o: o["spearman_geometric"])
    flips: dict[str, list[str]] = {}
    for o in oat:
        for fid in o["quadrant_flips"]:
            flips.setdefault(fid, []).append(o["scenario"])
    return {"min_weight_spearman": min(o["spearman_geometric"] for o in weight_rows) if weight_rows else None,
            "lowest": lowest, "quadrant_flips": flips}


def write_outputs(oat: list[dict], scanned_head: str) -> None:
    with open(os.path.join(HERE, "sensitivity.json"), "w", encoding="utf-8") as fh:
        json.dump({"scanned_head": scanned_head, "one_at_a_time": oat}, fh, indent=1)

    s = summarise(oat)
    md = ["# Sensitivity analysis\n",
          f"Baseline from `features.toml`, scanned at `{scanned_head}`. Each scenario changes one weight or modelling choice and re-evaluates the model against the same scan. Ranks are 1 = worst cost/usefulness ratio.\n",
          "## One-at-a-time\n",
          "Spearman correlation of the geometric ranking with the baseline (1.0 = identical order), the largest single rank move, the features moving 5+ places (baseline rank → new rank) and the user-facing features that change 2×2 quadrant.\n",
          "| Scenario | Spearman | Max move | Movers | Quadrant flips |", "|---|--:|--:|---|---|"]
    for o in oat:
        movers = ", ".join(f"`{i}` {a}→{b}" for i, a, b in o["movers"]) or "-"
        if "inherited_changes" in o:
            movers = "inherited score changes: " + (", ".join(f"`{i}` {a}→{b}" for i, a, b in o["inherited_changes"]) or "none")
        md.append(f"| {o['scenario']} | {o['spearman_geometric']} | {o['max_move']} | {movers} | {', '.join('`%s`' % f for f in o['quadrant_flips']) or '-'} |")

    md += ["\n## Summary\n"]
    if s["min_weight_spearman"] is not None:
        md.append(f"- Every cost weight at ×0.5 or ×1.5 keeps the ranking within Spearman {s['min_weight_spearman']} of the baseline.")
    md.append(f"- The largest reordering comes from `{s['lowest']['scenario']}` (Spearman {s['lowest']['spearman_geometric']}, largest move {s['lowest']['max_move']} places).")
    if s["quadrant_flips"]:
        md.append("- User-facing features that change 2×2 quadrant in at least one scenario: " + ", ".join(f"`{fid}` ({', '.join(sc)})" for fid, sc in sorted(s["quadrant_flips"].items(), key=lambda kv: -len(kv[1]))) + ".")
    else:
        md.append("- No user-facing feature changes 2×2 quadrant in any scenario.")
    md.append("- The 2×2 splits usefulness between 2 and 3, so a feature scoring 2 or 3 with above-median cost changes quadrant with a one-step change of its score; `score-review.md` lists those features.")
    with open(os.path.join(HERE, "sensitivity.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(md) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-churn", action="store_true")
    args = ap.parse_args()

    cfg, groups, features = cm.load_config()
    data = cm.scan(cfg, groups, features, no_churn=args.no_churn)
    oat = run_scenarios(data, cfg, groups, features)
    write_outputs(oat, data["scanned_head"])
    s = summarise(oat)
    print(f"wrote sensitivity.md and sensitivity.json ({len(oat)} scenarios); min weight Spearman {s['min_weight_spearman']}; "
          f"lowest {s['lowest']['scenario']} = {s['lowest']['spearman_geometric']}; quadrant flips: {len(s['quadrant_flips'])}")


if __name__ == "__main__":
    main()
