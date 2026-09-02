# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "pandas>=2.2",
#   "statsmodels>=0.14",
#   "matplotlib>=3.9",
# ]
# ///
"""Statistics stage of `yarn workspace agent-eval run results:compare`.

Reads dataset.csv + manifest.json from the staging directory given as argv[1];
writes estimates.csv/json, report.md, and curves/ back into it. Deterministic:
no seeds, no wall-clock values outside the manifest provenance block.
"""

import csv
import json
import math
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import statsmodels
import statsmodels.formula.api as smf
from statsmodels.stats.multitest import multipletests

ALPHA = 0.05


def fmt(value):
    """Canonical cell for CSV/JSON: repr for floats, '' for None."""
    if value is None:
        return ""
    if isinstance(value, float):
        return repr(value)
    return str(value)


def transform_series(series, transform):
    """Apply the registry transform; returns (values, anomaly_mask)."""
    if transform == "log":
        anomalies = series.notna() & (series <= 0)
        values = np.where(series > 0, np.log(series.where(series > 0)), np.nan)
        return pd.Series(values, index=series.index), anomalies
    if transform == "log0":
        values = np.where(series == 0, 0.0, np.log(series.where(series > 0)))
        return pd.Series(values, index=series.index), series.notna() & (series < 0)
    return series, pd.Series(False, index=series.index)


DEGENERATE = {
    "beta": float("nan"),
    "se": float("nan"),
    "ciLow": float("nan"),
    "ciHigh": float("nan"),
    "p": float("nan"),
}


def fit_pair(frame, control, treatment, pooled):
    """OLS with HC3 on control+treatment rows; returns the treatment term stats.

    Pooled fits use a case x workflow interaction model and report the
    unweighted average of the per-workflow effects, so every workflow weighs
    the same no matter how many runs it holds.
    """
    term = f'C(case, Treatment(reference="{control}"))[T.{treatment}]'
    formula = f'y ~ C(case, Treatment(reference="{control}"))'
    if pooled:
        formula += " * C(workflow)"
    fit = smf.ols(formula, frame).fit(cov_type="HC3")
    if not pooled:
        ci_low, ci_high = fit.conf_int(alpha=ALPHA).loc[term]
        return {
            "beta": float(fit.params[term]),
            "se": float(fit.bse[term]),
            "ciLow": float(ci_low),
            "ciHigh": float(ci_high),
            "p": float(fit.pvalues[term]),
        }
    # Per-workflow effect = main term (+ its interaction term outside the
    # reference workflow); the equal-weight average is one linear combination.
    interactions = [name for name in fit.params.index if name.startswith(f"{term}:C(workflow)")]
    n_workflows = int(frame["workflow"].nunique())
    if len(interactions) != n_workflows - 1:
        # A workflow lost an arm for this metric: the average is undefined.
        return dict(DEGENERATE)
    weights = pd.Series(0.0, index=fit.params.index)
    weights[term] = 1.0
    weights[interactions] = 1.0 / n_workflows
    combined = fit.t_test(weights.to_numpy())
    ci_low, ci_high = (float(value) for value in combined.conf_int(alpha=ALPHA)[0])
    return {
        # t_test result arrays come back 1x1; ravel to scalars.
        "beta": float(np.asarray(combined.effect).ravel()[0]),
        "se": float(np.asarray(combined.sd).ravel()[0]),
        "ciLow": ci_low,
        "ciHigh": ci_high,
        "p": float(np.asarray(combined.pvalue).ravel()[0]),
    }


def analyze(manifest, data):
    control = manifest["spec"]["control"]["shortName"]
    treatments = [t["shortName"] for t in manifest["spec"]["treatments"]]
    workflows = manifest["spec"]["workflows"]
    pooled = manifest["spec"]["mode"] == "aggregate"
    rows, skipped, anomaly_lines = [], [], []

    for metric in manifest["metrics"]:
        series, anomalies = transform_series(data[metric["key"]], metric["transform"])
        if anomalies.any():
            # log requires y > 0 (values <= 0 are anomalies); log0 maps 0 to 0 and
            # only rejects negatives. Named per-run so the report points straight
            # at the offending run instead of leaving a bare count.
            detail = "value <= 0 dropped" if metric["transform"] == "log" else "value < 0 dropped"
            for idx in data.index[anomalies]:
                row = data.loc[idx]
                anomaly_lines.append(
                    f'- {metric["key"]}: {row["case"]}/{row["workflow"]}/run-{row["run"]} ({detail})'
                )
        frame = pd.DataFrame(
            {"y": series, "case": data["case"], "workflow": data["workflow"]}
        ).dropna(subset=["y"])
        for treatment in treatments:
            pair = frame[frame["case"].isin([control, treatment])]
            n_control = int((pair["case"] == control).sum())
            n_treatment = int((pair["case"] == treatment).sum())
            if n_control < 2 or n_treatment < 2:
                skipped.append(
                    {
                        "metric": metric["key"],
                        "treatment": treatment,
                        "reason": f"needs >=2 values per arm, have control={n_control}, treatment={n_treatment}",
                    }
                )
                continue
            if pooled:
                # In the case x workflow interaction model, leverage is 1/n
                # within each cell, so a singleton cell puts HC3's 1/(1-h)
                # at a divide-by-zero and NaNs the whole covariance; an
                # empty cell drops the interaction term instead. Both doom
                # the fit, so name the thin cells here rather than letting
                # statsmodels warn its way to a NaN p-value.
                counts = pair.groupby(["case", "workflow"]).size()
                thin = [
                    f"{case}@{workflow}={int(counts.get((case, workflow), 0))}"
                    for case in (control, treatment)
                    for workflow in sorted(pair["workflow"].unique())
                    if counts.get((case, workflow), 0) < 2
                ]
                if thin:
                    skipped.append(
                        {
                            "metric": metric["key"],
                            "treatment": treatment,
                            "reason": f"needs >=2 values per case x workflow cell, have {', '.join(thin)}",
                        }
                    )
                    continue
            stats = fit_pair(pair, control, treatment, pooled)
            if not all(math.isfinite(v) for v in (stats["beta"], stats["se"], stats["ciLow"], stats["ciHigh"], stats["p"])):
                skipped.append(
                    {
                        "metric": metric["key"],
                        "treatment": treatment,
                        "reason": "degenerate fit (zero variance): p-value is not finite",
                    }
                )
                continue
            rows.append(
                {
                    "metric": metric["key"],
                    "treatment": treatment,
                    "scope": "pooled" if pooled else workflows[0],
                    "context": False,
                    "nControl": n_control,
                    "nTreatment": n_treatment,
                    **stats,
                    "pctChange": (
                        math.exp(stats["beta"]) - 1
                        if metric["transform"] in ("log", "log0")
                        else None
                    ),
                    "q": None,
                    "verdict": None,
                    "correctionGroup": None,
                    "direction": metric["direction"],
                    "transform": metric["transform"],
                    "anomalies": int(anomalies[data["case"].isin([control, treatment])].sum()),
                }
            )
            if pooled:
                for workflow in workflows:
                    sub = pair[pair["workflow"] == workflow]
                    if (sub["case"] == control).sum() < 2 or (sub["case"] == treatment).sum() < 2:
                        continue
                    context_stats = fit_pair(sub, control, treatment, pooled=False)
                    if not all(
                        math.isfinite(v)
                        for v in (
                            context_stats["beta"],
                            context_stats["se"],
                            context_stats["ciLow"],
                            context_stats["ciHigh"],
                            context_stats["p"],
                        )
                    ):
                        # Degenerate per-workflow fit (e.g. zero variance within this
                        # workflow slice); drop silently, context rows aren't part of
                        # the BH family or the "Skipped metrics" report section.
                        continue
                    rows.append(
                        {
                            "metric": metric["key"],
                            "treatment": treatment,
                            "scope": workflow,
                            "context": True,
                            "nControl": int((sub["case"] == control).sum()),
                            "nTreatment": int((sub["case"] == treatment).sum()),
                            **context_stats,
                            "pctChange": (
                                math.exp(context_stats["beta"]) - 1
                                if metric["transform"] in ("log", "log0")
                                else None
                            ),
                            "q": None,
                            "verdict": None,
                            "correctionGroup": None,
                            "direction": metric["direction"],
                            "transform": metric["transform"],
                            "anomalies": None,
                        }
                    )

    headline = [row for row in rows if not row["context"]]
    # BH within each correction group: the confirmatory group is the pre-facet
    # family, so its q-values are identical to the old single-family run.
    # Metrics without a declared group (older manifests) default to
    # 'confirmatory', which reproduces the old behaviour exactly.
    group_of = {
        m["key"]: m.get("correctionGroup", "confirmatory") for m in manifest["metrics"]
    }
    by_group = {}
    for row in headline:
        row["correctionGroup"] = group_of.get(row["metric"], "confirmatory")
        by_group.setdefault(row["correctionGroup"], []).append(row)
    for group_rows in by_group.values():
        _, q_values, _, _ = multipletests(
            [row["p"] for row in group_rows], alpha=ALPHA, method="fdr_bh"
        )
        for row, q in zip(group_rows, q_values):
            row["q"] = float(q)
            row["verdict"] = "significant" if q <= ALPHA else "not-significant"
    return rows, skipped, anomaly_lines


ESTIMATE_FIELDS = [
    "metric", "treatment", "scope", "context", "nControl", "nTreatment",
    "beta", "se", "ciLow", "ciHigh", "pctChange", "p", "q", "verdict",
    "direction", "transform", "anomalies", "correctionGroup",
]


def write_estimates(out_dir, rows):
    with open(out_dir / "estimates.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(ESTIMATE_FIELDS)
        for row in rows:
            writer.writerow([fmt(row[field]) if not isinstance(row[field], bool) else str(row[field]).lower() for field in ESTIMATE_FIELDS])
    (out_dir / "estimates.json").write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")


def draw_curves(out_dir, manifest, data, rows):
    plt.rcParams["svg.hashsalt"] = "agentic-ref"
    curves_dir = out_dir / "curves"
    curves_dir.mkdir(exist_ok=True)
    control = manifest["spec"]["control"]["shortName"]
    treatments = [t["shortName"] for t in manifest["spec"]["treatments"]]
    # Stable per-case colors from the manifest (curves render on white, so the
    # light variant applies); absent entries fall back to matplotlib's cycle.
    colors = manifest.get("colors") or {}
    for metric in manifest["metrics"]:
        for workflow in manifest["spec"]["workflows"]:
            fig, ax = plt.subplots(figsize=(7, 4.5))
            plotted = False
            has_zero = False
            for case in [control, *treatments]:
                values = data[(data["case"] == case) & (data["workflow"] == workflow)][
                    metric["key"]
                ].dropna()
                if values.empty:
                    continue
                plotted = True
                has_zero = has_zero or bool((values <= 0).any())
                xs = np.sort(values.to_numpy())
                ys = np.arange(1, len(xs) + 1) / len(xs)
                ax.step(
                    xs, ys, where="post",
                    color=(colors.get(case) or {}).get("light"),
                    label=f"{case} (n={len(xs)}, med={fmt(float(np.median(xs)))})",
                )
            if not plotted:
                plt.close(fig)
                continue
            if metric["transform"] in ("log", "log0") and not has_zero:
                ax.set_xscale("log")
            ax.set_title(f'{metric["label"]} — {workflow}')
            ax.set_ylabel("ECDF")
            ax.legend(loc="lower right", fontsize=8)
            verdicts = [
                f'{row["treatment"]}: q={fmt(row["q"])} {row["verdict"]}'
                for row in rows
                if row["metric"] == metric["key"] and not row["context"] and row["q"] is not None
            ]
            if verdicts:
                ax.text(
                    0.02, 0.98, "\n".join(verdicts), transform=ax.transAxes,
                    va="top", fontsize=8, family="monospace",
                )
            fig.tight_layout()
            base = curves_dir / f'{metric["key"]}@{workflow}'
            fig.savefig(f"{base}.svg", metadata={"Date": None})
            fig.savefig(f"{base}.png", metadata={"Software": None})
            plt.close(fig)


def write_report(out_dir, manifest, rows, skipped, anomaly_lines):
    spec = manifest["spec"]
    lines = [
        f'# Comparison: {spec["control"]["shortName"]} vs {"+".join(t["shortName"] for t in spec["treatments"])}',
        "",
        f'Workflows: {", ".join(spec["workflows"])} — mode: {spec["mode"]}, min runs: {spec["minRuns"]}.'
        + (
            " Aggregate effects weight every workflow equally, regardless of run counts."
            if spec["mode"] == "aggregate"
            else ""
        ),
        "",
        "## Verdicts",
        "",
        "| Metric | Treatment | β | 95% CI | % change | p | q | Verdict |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for row in rows:
        if row["context"]:
            continue
        arrow = "↓" if row["beta"] < 0 else "↑"
        lines.append(
            f'| {row["metric"]} | {row["treatment"]} | {fmt(row["beta"])} {arrow} '
            f'| [{fmt(row["ciLow"])}, {fmt(row["ciHigh"])}] | {fmt(row["pctChange"])} '
            f'| {fmt(row["p"])} | {fmt(row["q"])} | {row["verdict"]} |'
        )
    if any(row["transform"] == "log0" and not row["context"] for row in rows):
        lines += ["", "% change is approximate for log0 metrics (log(0) is mapped to 0)."]
    context_rows = [row for row in rows if row["context"]]
    if context_rows:
        lines += ["", "## Per-workflow context (not FDR-tested)", "",
                  "| Metric | Treatment | Workflow | β | p |", "|---|---|---|---|---|"]
        for row in context_rows:
            lines.append(
                f'| {row["metric"]} | {row["treatment"]} | {row["scope"]} | {fmt(row["beta"])} | {fmt(row["p"])} |'
            )
    if skipped:
        lines += ["", "## Skipped metrics", ""]
        lines += [f'- {s["metric"]} × {s["treatment"]}: {s["reason"]}' for s in skipped]
    if anomaly_lines:
        lines += ["", "## Anomalous values", ""]
        lines += anomaly_lines
    if manifest.get("excludedRuns"):
        lines += ["", "## Excluded runs", ""]
        lines += [f'- `{e["path"]}` — {e["reason"]}' for e in manifest["excludedRuns"]]
    lines += ["", "## Cells", "", "| Case | Workflow | Usable | Passed | Failed | Unanalyzed | Superseded |", "|---|---|---|---|---|---|---|"]
    for cell in manifest["cells"]:
        lines.append(
            f'| {cell["case"]} | {cell["workflow"]} | {cell["usableRuns"]} '
            f'| {cell["passed"]} | {cell["failed"]} | {cell["unanalyzed"]} | {cell["superseded"]} |'
        )
    lines += ["", "Curves: see `curves/<metric>@<workflow>.svg`.", ""]
    (out_dir / "report.md").write_text("\n".join(lines), encoding="utf-8")


def main():
    out_dir = Path(sys.argv[1])
    manifest = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
    data = pd.read_csv(out_dir / "dataset.csv", dtype={"case": str, "workflow": str, "batch": str})
    rows, skipped, anomaly_lines = analyze(manifest, data)
    write_estimates(out_dir, rows)
    draw_curves(out_dir, manifest, data, rows)
    write_report(out_dir, manifest, rows, skipped, anomaly_lines)
    # Replace the declared metrics×treatments grid with the family actually
    # corrected against: pairs skipped (too few values, degenerate fit) never
    # entered the BH correction, so the manifest must not claim they did.
    manifest["family"] = [
        {"metric": r["metric"], "treatment": r["treatment"], "correctionGroup": r["correctionGroup"]}
        for r in rows
        if not r["context"]
    ]
    manifest["provenance"] = {
        **manifest.get("provenance", {}),
        "python": sys.version.split()[0],
        "pandas": pd.__version__,
        "statsmodels": statsmodels.__version__,
        "matplotlib": matplotlib.__version__,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    significant = sum(1 for row in rows if row["verdict"] == "significant")
    headline = sum(1 for row in rows if not row["context"])
    print(f"{headline} headline tests, {significant} significant at FDR 5%.")


if __name__ == "__main__":
    main()
