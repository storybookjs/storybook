# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "pandas>=2.2",
#   "statsmodels>=0.14",
#   "matplotlib>=3.9",
# ]
# ///
"""Statistics stage of `pnpm results:compare`.

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


def arm_counts(sub, control, treatment):
    return int((sub["case"] == control).sum()), int((sub["case"] == treatment).sum())


def slice_skip(sub, control, treatment):
    """(code, reason) when this slice cannot support a fit, else None.

    The order matters for the reason a reader sees: absent arms are named
    before thin ones, and only a fittable sample is checked for variance —
    a constant response would otherwise let OLS solver noise (beta ~1e-15,
    se ~1e-16) masquerade as a significant effect. Since both arms have
    data by the time the variance check runs, a constant response always
    means the arms are identical: a known zero difference with nothing to
    test, coded 'identical' so reports can show it as "=" rather than
    "not comparable".
    """
    n_control, n_treatment = arm_counts(sub, control, treatment)
    if n_control == 0 and n_treatment == 0:
        return "no-data", "no data in either arm"
    if n_control == 0:
        return "no-control-data", "no control data to compare to"
    if n_treatment == 0:
        return "no-treatment-data", "no treatment data to compare to"
    if n_control < 2 or n_treatment < 2:
        return (
            "insufficient-data",
            f"needs >=2 values per arm, have control={n_control}, treatment={n_treatment}",
        )
    values = sub["y"].to_numpy(dtype=float)
    if float(np.max(values) - np.min(values)) <= 1e-12 * max(1.0, abs(float(np.mean(values)))):
        return "identical", f"identical: every run in both arms scored {fmt(float(values[0]))}"
    return None


def finite_fit(stats):
    return all(
        math.isfinite(stats[key]) for key in ("beta", "se", "ciLow", "ciHigh", "p")
    )


def analyze(manifest, data):
    control = manifest["spec"]["control"]["shortName"]
    treatments = [t["shortName"] for t in manifest["spec"]["treatments"]]
    workflows = manifest["spec"]["workflows"]
    pooled = manifest["spec"]["mode"] == "aggregate"
    rows, skips, anomaly_lines = [], [], []

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
        raw = pd.DataFrame(
            {"y": data[metric["key"]], "case": data["case"], "workflow": data["workflow"]}
        ).dropna(subset=["y"])
        for treatment in treatments:
            pair = frame[frame["case"].isin([control, treatment])]

            def arm_stat(case, workflow=None, kind="mean"):
                """Descriptive stat on the raw (untransformed) values, for reports."""
                scoped = raw[raw["case"] == case]
                if workflow is not None:
                    scoped = scoped[scoped["workflow"] == workflow]
                if scoped.empty:
                    return None
                return float(scoped["y"].mean() if kind == "mean" else scoped["y"].median())

            def record_skip(scope, context, code, reason, sub):
                n_control, n_treatment = arm_counts(sub, control, treatment)
                workflow = scope if context else None
                skips.append(
                    {
                        "metric": metric["key"],
                        "treatment": treatment,
                        "scope": scope,
                        "context": context,
                        "code": code,
                        "reason": reason,
                        "nControl": n_control,
                        "nTreatment": n_treatment,
                        "controlMean": arm_stat(control, workflow),
                        "controlMedian": arm_stat(control, workflow, "median"),
                        "treatmentMean": arm_stat(treatment, workflow),
                        "treatmentMedian": arm_stat(treatment, workflow, "median"),
                    }
                )

            def emit_row(stats, sub, scope, context, support=None):
                n_control, n_treatment = arm_counts(sub, control, treatment)
                rows.append(
                    {
                        "metric": metric["key"],
                        "treatment": treatment,
                        "scope": scope,
                        "context": context,
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
                        "anomalies": (
                            int(anomalies[data["case"].isin([control, treatment])].sum())
                            if not context
                            else None
                        ),
                        "support": support,
                    }
                )

            if not pooled:
                skip = slice_skip(pair, control, treatment)
                if skip is not None:
                    record_skip(workflows[0], False, *skip, pair)
                    continue
                stats = fit_pair(pair, control, treatment, pooled=False)
                if not finite_fit(stats):
                    record_skip(
                        workflows[0], False, "degenerate", "degenerate fit: p-value is not finite", pair
                    )
                    continue
                emit_row(stats, pair, workflows[0], False)
                continue

            # Aggregate mode. The headline pools over the common support: the
            # workflows where BOTH arms have >=2 values. Elsewhere the case x
            # workflow interaction model is unidentified — an empty arm makes
            # the workflow dummy collinear with its interaction term
            # (SingularMatrixWarning, arbitrary pinv coefficients), and a
            # singleton cell puts HC3's 1/(1-h) at a divide-by-zero. Restricting
            # the frame keeps the estimable comparison instead of deleting the
            # metric with it.
            qualifying = []
            for workflow in workflows:
                sub = pair[pair["workflow"] == workflow]
                n_control, n_treatment = arm_counts(sub, control, treatment)
                if n_control >= 2 and n_treatment >= 2:
                    qualifying.append(workflow)
            if not qualifying:
                record_skip(
                    "pooled", False, "no-common-support",
                    "no workflow has >=2 values in both arms", pair,
                )
            else:
                support = pair[pair["workflow"].isin(qualifying)]
                skip = slice_skip(support, control, treatment)
                if skip is not None:
                    record_skip("pooled", False, *skip, support)
                else:
                    # A single qualifying workflow leaves nothing to interact:
                    # the plain model on that slice is the same estimate.
                    stats = fit_pair(support, control, treatment, pooled=len(qualifying) > 1)
                    if not finite_fit(stats):
                        record_skip(
                            "pooled", False, "degenerate",
                            "degenerate fit: p-value is not finite", support,
                        )
                    else:
                        emit_row(stats, support, "pooled", False, support="+".join(qualifying))

            # Per-workflow context rows stand on their own slice, never on the
            # pooled fit's fate: a workflow with a sound 2x2 comparison keeps
            # its row even when another workflow starves the pooled support.
            for workflow in workflows:
                sub = pair[pair["workflow"] == workflow]
                skip = slice_skip(sub, control, treatment)
                if skip is not None:
                    record_skip(workflow, True, *skip, sub)
                    continue
                context_stats = fit_pair(sub, control, treatment, pooled=False)
                if not finite_fit(context_stats):
                    record_skip(
                        workflow, True, "degenerate", "degenerate fit: p-value is not finite", sub
                    )
                    continue
                emit_row(context_stats, sub, workflow, True)

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
    return rows, skips, anomaly_lines


ESTIMATE_FIELDS = [
    "metric", "treatment", "scope", "context", "nControl", "nTreatment",
    "beta", "se", "ciLow", "ciHigh", "pctChange", "p", "q", "verdict",
    "direction", "transform", "anomalies", "correctionGroup", "support",
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


def arm_note(skip):
    """One line of descriptive stats per arm, so a skip still shows the data."""
    parts = []
    for arm, n_key, mean_key in (
        ("control", "nControl", "controlMean"),
        ("treatment", "nTreatment", "treatmentMean"),
    ):
        note = f"{arm} n={skip[n_key]}"
        if skip[mean_key] is not None:
            note += f", mean {fmt(skip[mean_key])}"
        parts.append(note)
    return "; ".join(parts)


def write_report(out_dir, manifest, rows, skips, anomaly_lines):
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
    all_support = "+".join(spec["workflows"])
    partial = [
        row for row in rows
        if not row["context"] and row.get("support") and row["support"] != all_support
    ]
    if partial:
        lines += [""] + [
            f'- {row["metric"]} × {row["treatment"]}: pooled over '
            f'{row["support"].replace("+", ", ")} only — the other workflows lack '
            "≥ 2 values in both arms."
            for row in partial
        ]
    # One table carries fitted and unfittable slices alike: a workflow with no
    # control data still shows its descriptive stats, denoted as incomparable
    # rather than silently absent.
    metric_order = {m["key"]: i for i, m in enumerate(manifest["metrics"])}
    workflow_order = {wf: i for i, wf in enumerate(spec["workflows"])}
    context_rows = [row for row in rows if row["context"]]
    context_skips = [s for s in skips if s["context"]]
    if context_rows or context_skips:
        lines += ["", "## Per-workflow context (not FDR-tested)", "",
                  "| Metric | Treatment | Workflow | β | p | Note |", "|---|---|---|---|---|---|"]
        entries = [("row", row) for row in context_rows] + [("skip", s) for s in context_skips]
        entries.sort(key=lambda e: (
            metric_order.get(e[1]["metric"], len(metric_order)),
            e[1]["treatment"],
            workflow_order.get(e[1]["scope"], len(workflow_order)),
        ))
        for kind, entry in entries:
            if kind == "row":
                lines.append(
                    f'| {entry["metric"]} | {entry["treatment"]} | {entry["scope"]} '
                    f'| {fmt(entry["beta"])} | {fmt(entry["p"])} | |'
                )
            else:
                lines.append(
                    f'| {entry["metric"]} | {entry["treatment"]} | {entry["scope"]} '
                    f'| — | — | {entry["reason"]} ({arm_note(entry)}) |'
                )
    headline_skips = [s for s in skips if not s["context"]]
    if headline_skips:
        lines += ["", "## Skipped metrics", ""]
        lines += [
            f'- {s["metric"]} × {s["treatment"]}: {s["reason"]} ({arm_note(s)})'
            for s in headline_skips
        ]
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
    rows, skips, anomaly_lines = analyze(manifest, data)
    write_estimates(out_dir, rows)
    # Skips are data for the reports, not just prose: the HTML report renders
    # a "no comparison" lane from each record that still carries arm stats.
    (out_dir / "skips.json").write_text(json.dumps(skips, indent=2) + "\n", encoding="utf-8")
    draw_curves(out_dir, manifest, data, rows)
    write_report(out_dir, manifest, rows, skips, anomaly_lines)
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
