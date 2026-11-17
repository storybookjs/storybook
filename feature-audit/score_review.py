#!/usr/bin/env python3
"""Write score-review.md: the user-facing features whose verdict depends on their usefulness score,
with the evidence needed to re-score them. Reads metrics.json and sensitivity.json.

A feature is listed when any of these holds:
  - it sits in the low-usefulness, high-cost quadrant of the 2x2;
  - it ranks in the worst 20 under at least one usefulness hypothesis;
  - it changes quadrant in at least one sensitivity scenario;
  - it scores 2 or 3 with above-median cost, so a one-step score change moves it across the
    quadrant line (the 2x2 splits usefulness between 2 and 3).

  python3 feature-audit/score_review.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compute_metrics as cm  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
m = json.load(open(os.path.join(HERE, "metrics.json"), encoding="utf-8"))
s = json.load(open(os.path.join(HERE, "sensitivity.json"), encoding="utf-8"))
rows = {r["id"]: r for r in m["features"]}
median = cm.median_user_cost(m["features"])
flips: dict[str, list[str]] = {}
for o in s.get("one_at_a_time", []):
    for fid in o["quadrant_flips"]:
        flips.setdefault(fid, []).append(o["scenario"])
HYP_LABEL = {"linear": "linear", "geometric": "3×", "reach": "reach", "inherited": "inherited"}


def reasons(r: dict) -> list[str]:
    out = []
    if cm.quadrant_of(r, median) == "sunset":
        out.append("low-usefulness, high-cost quadrant")
    best = min(cm.HYPOTHESES, key=lambda h: r[f"rank_{h}"])
    if r[f"rank_{best}"] <= 20:
        out.append(f"rank {r[f'rank_{best}']} under {HYP_LABEL[best]}")
    if r["id"] in flips:
        out.append("changes quadrant when " + ", ".join(flips[r["id"]]))
    if r["usefulness"] in (2, 3) and r["cost"] >= median:
        out.append("one score step from the quadrant line")
    return out


sel = [(r, reasons(r)) for r in rows.values() if not r["maintainer_only"]]
sel = [(r, why) for r, why in sel if why]
sel.sort(key=lambda rw: (cm.quadrant_of(rw[0], median) != "sunset", min(rw[0][f"rank_{h}"] for h in cm.HYPOTHESES)))
md = ["# Usefulness score review\n",
      "These are the user-facing features whose verdict depends on their usefulness score rather than on the cost model: the low-usefulness, high-cost quadrant, the worst 20 under any hypothesis, the features that change quadrant in a sensitivity scenario, and the features one score step away from the quadrant line. Re-score them in `features.toml` (`usefulness`, optionally `reach`) and rerun `compute_metrics.py` and `sensitivity.py`.\n",
      "Scale: 4 mission-critical, 3 high (large share of installs or strategically central), 2 medium (a segment, or experimental with a credible path), 1 low (niche, replaceable, or on a sunset path).\n",
      "| Feature | Current U | Reach (why) | npm/mo | Open issues | Fix PRs (12 mo) | Feature PRs | Src LOC | Excl. deps | Quadrant | Rank linear / 3× / reach / inherited | Why listed | Current rationale | Your score |",
      "|---|:-:|---|--:|--:|--:|--:|--:|--:|---|---|---|---|:-:|"]
for r, why in sel:
    npm = "" if r["npm_downloads"] is None else f"{r['npm_downloads']:,}"
    ranks = " / ".join(str(r[f"rank_{h}"]) for h in cm.HYPOTHESES)
    md.append(f"| **{r['name']}** (`{r['id']}`) | {r['usefulness']} | {r['reach']:.2f} ({r['reach_rationale'] or r['reach_source']}) | "
              f"{npm} | {'' if r['open_issues'] is None else r['open_issues']} | {r['prs_fix']} | {r['prs_feature']} | "
              f"{r['src_loc']:,} | {r['n_exclusive_deps']} | {cm.quadrant_of(r, median)} | {ranks} | {'; '.join(why)} | {r['rationale']} |  |")
open(os.path.join(HERE, "score-review.md"), "w", encoding="utf-8").write("\n".join(md) + "\n")
print(f"wrote score-review.md with {len(sel)} features")
