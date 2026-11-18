# Storybook feature audit

A reproducible inventory of Storybook's features with their maintenance cost (code volume,
third-party dependencies, bug-fix and maintenance churn) and a usefulness judgement, ranked under
several usefulness hypotheses and presented as decision views (2×2, sunset list, simplification
list) plus a sensitivity analysis. The feature map was drawn at commit `db128150dc9` (2026-10-20);
each generated file records the HEAD it was scanned at, since the checkout moves.

The folder is committed on its own branch so that it survives `git clean` and checkout moves. The
pipeline runs in a bare checkout: without `node_modules`, third-party dependencies are detected from
the registry snapshot in `signals/npm-packages.json` (the ranking header says so when that happens),
so run `yarn` first when the snapshot may be behind the source.

## Files

| File | Role |
| --- | --- |
| `REPORT.md` | The written analysis. Round sections at the top describe the current model and findings; the round-1 sections below them are kept for reference. |
| `features.toml` | **Editable source of truth.** Ten macro groups and 101 leaf features, each with repo globs, a usefulness score (1–4), a rationale, a hand-set `reach` with its own justification where no npm package measures it, and optional `maintainer_only`. Also holds `[weights]`, `[usefulness]` and `[churn]`. |
| `compute_metrics.py` | Reads `features.toml` and the signals, scans the repo (`scan()`), evaluates the model (`evaluate()`), and regenerates the four outputs below. Standard library only; Python ≥ 3.11. |
| `ranking.md` | Generated. Every feature with all metrics and its ratio/rank under each usefulness hypothesis (plus 2× and 4× scale columns); reach justifications; group rollup; dependency lists with release cadence and staleness; the internal import graph; coverage report. |
| `quadrants.md` | Generated. The 2×2 (usefulness × cost), the sunset list (usefulness ≤ 2 by exclusive cost), the simplification list (usefulness ≥ 3 by cost with churn weighted), the maintainer-only table, and the agreement table across hypotheses. |
| `metrics.json` / `metrics.csv` | Generated. Everything the script knows, per feature and per group, including dependency and import-graph detail. |
| `sensitivity.py` | Re-evaluates the model against one scan, one change at a time: every cost weight at ×0.5 and ×1.5, churn/dependency/test pricing switched off, coupling priced, geometric base 2/4, one-hop inheritance → `sensitivity.md`, `sensitivity.json`. |
| `score_review.py` | Writes `score-review.md`: the features whose verdict depends on their usefulness score, with the evidence to re-score them. |
| `build_site.py` | Builds the website: `site/index.html` (open locally) and `site/artifact.html` (the same page for publishing), one self-contained file with the data embedded, no server or build step, Google Fonts only. |
| `fetch_pr_labels.py` | Collects merged PRs (merge commits reachable from `origin/next`, deduplicated by number) with changed files from git and labels/titles from the GitHub GraphQL API → `signals/github-merged-prs.json`. Needs `gh auth`. |
| `fetch_pr_issues.py` | Adds the issues each PR closes, with their labels, to the same file (severity inheritance, category inference). |
| `fetch_npm_metadata.py` | Fetches registry metadata for every third-party dependency in `metrics.json` (releases in 12 months, days since last publish, unpacked size, deprecation) → `signals/npm-packages.json`. Incremental; `--refresh` refetches all. |
| `signals/npm-downloads-last-month.json` | Captured npm download counts per published package (adoption / reach signal). |
| `signals/github-open-issues-by-label.json` | Captured open-issue counts per GitHub label (support-load signal). |
| `signals/github-merged-prs.json` | Merged PRs with labels, files and closed issues (churn signal). |
| `signals/npm-packages.json` | Registry metadata for every third-party dependency (dependency-cost signal). |
| `notes/` | Raw line-count, import and churn tables by directory, and the three small scripts that produce them. |

## Regenerate

```bash
python3 -I feature-audit/compute_metrics.py
```

Flags: `--no-churn` skips the git log scan and the PR signal (fast), `--no-signals` ignores every
`signals/` file. To refresh the signals:

```bash
python3 -I feature-audit/fetch_pr_labels.py --since 2025-10-20 --ref origin/next && python3 -I feature-audit/fetch_pr_issues.py
```

```bash
python3 -I feature-audit/fetch_npm_metadata.py
```

Sensitivity analysis and the score-review sheet (one scan plus about twenty evaluations):

```bash
python3 -I feature-audit/sensitivity.py && python3 -I feature-audit/score_review.py
```

The website (after the steps above):

```bash
python3 -I feature-audit/build_site.py
```

## How the numbers are computed

- **Files** come from `git ls-files` under `code/`, `scripts/`, `agent-eval/` and `test-storybooks/`
  (`meta.scan_roots`). Only `.ts .tsx .js .jsx .mjs .cjs .mts .cts .vue .svelte` are counted.
- **Classification** (first matching rule in `CLASSIFY_RULES` wins): `ignore` (built output such as
  `test-storybooks/ember-cli/ember-output`, `code/sandbox`), `fixture` (templates, mocks, mock data,
  `__testfixtures__`, sync-test harnesses, …), `test` (`*.test.*`, `*.spec.*`, e2e suites, vitest
  configs, the internal `.storybook`), `stories`, `dts`, otherwise `src`.
- **Assignment**: a file belongs to the feature whose `include` glob matches it with the most literal
  characters, after that feature's `exclude` globs are applied. Globs are repo-root-relative; `**`
  spans directories, `*` stays within a segment. Ties and unclaimed files are reported under
  "Coverage" in `ranking.md`.
- **Dependencies**: distinct third-party packages imported by the feature's `src` files, excluding
  Node built-ins, `storybook/*` and workspace packages, and only if installed under some
  `node_modules` (filters specifiers inside generated-code templates). **Exclusive** dependencies are
  those no other feature imports. Each dependency costs
  `dependency_base + dependency_per_release × min(releases_12mo, dependency_release_cap)`, plus
  `dependency_stale_penalty` when unpublished for `dependency_stale_days` or deprecated.
- **Import graph**: relative imports, `storybook/<entry>` imports (resolved through
  `code/core/build-config.ts`) and workspace-package imports are resolved to the owning feature.
  `fan_out` is the number of features a feature imports from; `fan_in` the number that import it.
- **Reach** is hand-set (`reach`, `reach_rationale`) for in-core features and npm-derived (package
  downloads ÷ `storybook` downloads, floored at `reach_floor`) for packaged ones; an explicit value
  always wins.
- **Churn**: two signals. Raw non-merge commits since `meta.churn_since` (bulk commits touching more
  than `churn_bulk_commit_threshold` files dropped; weight `churn`, default 0). Labelled PRs,
  categorised by `[churn].categories` in order (`release` ignored, then `fix`, `feature`,
  `maintenance`, `docs`, else `other`; an unlabelled PR inherits the category of a bug-labelled issue
  it closes when `infer_category_from_issues` is on), attributed to every feature whose files they
  touch; PRs with more than `bulk_files_threshold` files are dropped. Fix PRs are multiplied by
  `[churn].severity_multipliers` keyed on their `sev:*` label (own label first, else the closed
  issue's, else `none`); `fix_pr` is the 1× rate and `maintenance_pr` prices maintenance PRs; feature
  and docs PRs are investment and unpriced.
- **Cost** = `src_loc + test_loc × (test + stories + fixture loc) + Σ dependency cost + fix_pr ×
  severity-weighted fix PRs + maintenance_pr × maintenance PRs + churn × commits + internal_fan_out ×
  fan-out`. **Exclusive cost** replaces the dependency term with exclusive dependencies only; it is
  what removal would actually save.
- **Usefulness hypotheses** (denominators, computed side by side):
  - `linear`: the 1–4 score as is.
  - `geometric`: each level is worth `geometric_base` times the level below (base 3 → 1/3/9/27).
    `geometric_bases_side_by_side` adds rank columns for other multipliers (2 → 1/2/4/8,
    4 → 1/4/16/64).
  - `reach`: estimated share of installs (see above).
  - `inherited`: geometric, after each feature inherits the highest score of any feature that
    genuinely depends on it. Importers in `inheritance_exclude_importers` (presets, shell, CLI and
    other aggregators that wire everything) and maintainer-only features do not propagate; same-group
    edges are ignored when `inheritance_ignore_same_group` is on (a sub-feature carved out of a
    parent must not inherit from it); an edge counts only with at least `inheritance_min_imports`
    import statements; `inheritance_transitive` toggles multi-hop propagation.
- **Ratios and ranks**: `cost ÷ hypothesis` for each hypothesis, plus `ratio_exclusive_geometric`.
  `rank_mean` and `rank_spread` summarise agreement across hypotheses.
- **Decision views** (`quadrants.md`) use user-facing features only (groups or features flagged
  `maintainer_only` are listed separately): the 2×2 splits usefulness at 3 and cost at the median.

## How to iterate

- **Disagree with a score**: edit `usefulness` (and `rationale`) in `features.toml`, rerun.
  `score-review.md` lists the features whose verdict depends on the score.
- **Set a reach you know**: edit `reach` and `reach_rationale` on the feature.
- **Change the cost model**: edit `[weights]`. Setting `churn = 5` prices raw commits; setting
  `internal_fan_out = 100` prices coupling; `fix_pr = 0` returns to a size-only model.
- **Change the label mapping or severity multipliers**: edit `[churn]`.
- **Split or merge features**: add/remove `[[feature]]` blocks. Keep `id` unique and `group` valid.
  Use `exclude` on a broad feature when carving a narrower one out of it, or rely on specificity.
- **Re-snapshot on a newer commit**: update `[meta]`, rerun the fetch scripts, rerun the metrics
  script, and check the Coverage section for new unclaimed directories.

## What the sensitivity analysis established

Cost weights barely change the order: every ±50% change keeps the 3×-scale ranking at Spearman
0.996 or better against the baseline, and switching a whole cost component off (churn, dependencies
or tests) stays between 0.969 and 0.988. The geometric base is the influential modelling choice
(base 2 gives 0.899, base 4 gives 0.964). No weight scenario moves the three features in the
low-usefulness, high-cost quadrant. Because the 2×2 splits usefulness between 2 and 3, a feature
scoring 2 or 3 with above-median cost changes quadrant with a one-step change of its score, which is
why those scores were reviewed by hand in round 4. See `sensitivity.md` and `REPORT.md`.

## Known limitations

- Lines of code measure size, not difficulty. Fix-PR counts (severity-weighted) and open issues are
  the closest proxies and are part of the cost; raw commits are reported but unpriced.
- A PR that touches several features is counted once per feature, so group fix-PR totals exceed the
  number of PRs.
- Dependency weights treat a release as a release; a Babel plugin bump and a Next.js major cost the
  same. Unpacked size is captured but unused.
- The inherited hypothesis still misfires when attribution puts shared utilities inside a feature
  (component manifests inherit from the React renderer's preset wiring, for instance).
- The reach hypothesis divides by share of installs, so cheap packages for small communities get
  large ratios. It answers "cost per user served", not "is this a burden".
- Usefulness scores started as one person's judgement; the 15 decision-critical ones were re-scored
  by the maintainer in round 4 and are marked as such in their rationale.
- Prose shipped as code (agent skills, setup prompts) inflates `src_loc` relative to its complexity.
- `docs/` (the documentation site) is not attributed to features and is a real, uncounted cost.
