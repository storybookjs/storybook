# Running the experiments

Every script and experiment produced during the inner-loop investigation is reproducible from this repo. This page is the single entry point — for each experiment: what it does, where it lives, what branch it expects, and the exact command to run.

## TL;DR

| Want to... | Run | Branch |
|---|---|---|
| Measure cascade size for an arbitrary changed file | `node --experimental-transform-types --no-warnings project-documents/questions/appendix/cd-experiment.ts` | any |
| Estimate token cost of the `get_change_context` payload at multiple scales (offline) | `node --experimental-transform-types --no-warnings project-documents/questions/appendix/token-cost-experiment.ts` | any |
| Run end-to-end agent eval against a live Storybook UI | `node --experimental-transform-types --no-warnings scripts/eval/inner-loop/run.ts` | `yann/story-review-project-analysis` |
| **Run agent eval with the signature prompt (cascade-scale-safe)** | `… scripts/eval/inner-loop/run.ts --scenario large --prompt signature --effort low --trace` | same |
| **Measure run-to-run variance** | `… scripts/eval/inner-loop/run.ts --scenario small --prompt signature --effort low --runs 5 --out variance.jsonl` | same |
| **CSS blast-radius synthesis (Experiment C)** | `… scripts/eval/inner-loop/css-blast-experiment.ts` | any |
| **Module-graph histogram (Round-2 I.1)** | `… scripts/eval/inner-loop/module-graph-experiment.ts` | any |
| **Deterministic clustering baselines (Round-2 §O)** | `… scripts/eval/inner-loop/deterministic-baselines.ts` | any |
| **Replay real dogfood commits (Round-2 §L)** | `… scripts/eval/inner-loop/replay-real-commits.ts --max 25` | `yann/story-review-project-analysis` |
| **Build the HTML report** | `… scripts/eval/inner-loop/build-report.ts` | any |
| Historical reference: the legacy HMR + probe patches | `git apply project-documents/questions/appendix/patches/0*.patch` | superseded — see FOLLOWUP.md |

All scripts require **Node 22+** (the repo's `.nvmrc` is `22.22.1`). The `--experimental-transform-types --no-warnings` flags are needed because the change-detection module transitively uses TypeScript enums which Node 22's strip-only TS support can't handle.

> **Use `fnm` if `node` is missing on PATH:** `eval "$(fnm env --shell bash)" && fnm use 22.22.1` (the repo uses fnm via `.nvmrc`).

> **Run scripts from the repo root** (`/Users/.../storybook/`), not from `code/`. The harness uses workspace-relative imports and will fail with `MODULE_NOT_FOUND` if you run it from `code/`.

---

## 1. `cd-experiment.ts` — change-detection cascade measurement

**Location:** `project-documents/questions/appendix/cd-experiment.ts`

**What it does:** runs Storybook's real `DependencyGraphBuilder` against this monorepo's story files (mirroring the dogfood `viteFinal` alias config) and reports the blast radius of synthetic file changes. Reproduces the empirical numbers in [`appendix/INVESTIGATION_FINDINGS.md`](questions/appendix/INVESTIGATION_FINDINGS.md) §13/§16/§21.

**Run:**

```bash
node --experimental-transform-types --no-warnings \
  project-documents/questions/appendix/cd-experiment.ts
```

**Output:** prints to stdout — graph size, per-file blast radius for ~10 probe files, top 20 files by importer count, CSS/`.d.ts` blindness verifications. Takes ~1 second.

**Branch:** works on both `next` (uses PR #34675's barrel-aware named-import resolution) and `valentin/before-after` (older algorithm). Numbers differ by ±1-3 importers per file; barrel-awareness did not materially reduce noise in this codebase.

**Why this script exists:** validates that the noise problem the project exists to solve is real and at the scale we documented.

---

## 2. `token-cost-experiment.ts` — payload token cost estimation

**Location:** `project-documents/questions/appendix/token-cost-experiment.ts`

**What it does:** constructs synthetic `get_change_context` MCP-tool payloads at three cascade scales (typical 110, cascade 1,212, worst-case 3,250) and measures token count using the same fast estimator `@storybook/addon-mcp` ships. Also computes "filter-approach" cost (sending source for each story) for comparison.

**Run:**

```bash
node --experimental-transform-types --no-warnings \
  project-documents/questions/appendix/token-cost-experiment.ts
```

**Output (representative):**

```
TYPICAL edit (Sidebar.tsx → 110 stories)
  Estimated tokens: 2,736 (~2.7K)
  As % of 200K context: 1.4%
CASCADE edit (theming/index.ts → 1,212 stories)
  Estimated tokens: 22,148 (~22.1K)
  As % of 200K context: 11%
WORST-CASE (5K-story repo, 60% cascade, 8 changed files)
  Estimated tokens: 63,499 (~63.5K)
  As % of 200K context: 32%
Filter approach exceeds 200K context at >611 stories
```

**Why this script exists:** evidence base for [Page 2 §"Empirical token cost"](questions/02_DETERMINISTIC_VS_AI.md). Decisive vindication of the categoriser-over-filter framing.

---

## 3. `scripts/eval/inner-loop/run.ts` — end-to-end agent eval harness

**Location:** `scripts/eval/inner-loop/`

**What it does:** runs synthetic edits against a live Storybook UI on `localhost:6006`, reads the deterministic change-detection baseline, builds the proposed `get_change_context` payload, optionally invokes Claude with the categoriser prompt, scores the output (recall / precision / cluster purity), and writes a JSONL row to `results/`.

Re-uses the `@anthropic-ai/claude-agent-sdk` from `scripts/eval/lib/agents/claude-code.ts` — subscription-based auth via local Claude Code, no `ANTHROPIC_API_KEY` required.

**Setup (one-time):**

The harness needs a `/_status_/change-detection` endpoint on the Storybook UI. On `yann/story-review-project-analysis` this is **already wired in** — `statusProbePlugin()` is registered alongside the other before-after Vite plugins in [`code/addons/before-after/src/preset.ts`](../code/addons/before-after/src/preset.ts). No patches required.

```bash
git checkout yann/story-review-project-analysis
yarn install
yarn nx compile addon-before-after
cd code && yarn storybook:ui     # serves http://localhost:6006
```

If you're working from an older branch without the probe, the harness prints a DevTools probe snippet to copy into the Storybook tab's console — paste, save the printed JSON to `/tmp/sb-cd-statuses.json`, re-run. The patches in [`questions/appendix/patches/`](questions/appendix/patches/README.md) are kept as historical reference only; the canonical path is the registered plugin on this branch.

**Run (in a separate terminal):**

```bash
# The harness only talks to the running Storybook UI, so any branch with the
# SDK installed works. Easiest is the same yann/story-review-project-analysis branch.

# Baseline only (no agent — measures payload size + ground truth)
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/run.ts --baseline-only

# Full eval with Claude (default: enumerate prompt — hangs on medium/large; use --prompt signature instead)
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/run.ts --prompt signature --effort low

# One scenario, verbose, repeated 5× for variance measurement
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/run.ts \
    --scenario small --prompt signature --effort low --runs 5 --out variance.jsonl
```

**All flags:**

| flag | values | what it does |
|---|---|---|
| `--scenario` | `small`/`medium`/`large`/`css-only`/`regex-aliased` | run only the named scenario (default: all) |
| `--baseline-only` | — | skip agent invocation; just measure tokens / ground truth |
| `--runs` | integer (default 1) | repeat each scenario N times (use for variance measurement) |
| `--no-cleanup` | — | don't revert edits at end (debug-only) |
| `--verbose` | — | print one-line per assistant message |
| `--trace` | — | print every SDK message with timestamp (`[+1.9s] system subtype=init`, `[+10s] assistant [thinking]`, `[+18s] result cost=$0.18 in=37000 out=962`) — useful for diagnosing hangs |
| `--model` | SDK model id (default `claude-sonnet-4-6`) | override agent model |
| `--effort` | `low`/`medium`/`high`/`max` (default `medium`) | reasoning effort |
| `--prompt` | `enumerate`/`signature` (default `enumerate`) | **`enumerate` asks the agent to list every story per cluster (output ~30K tokens — hangs at cascade scale). `signature` asks for cluster *signatures* (prefix/regex/ids patterns) — output stays under 1K tokens regardless of cascade size, deterministic system expands. Use `signature` for any non-trivial scenario.** |
| `--out` | filename | write JSONL to `results/<filename>` instead of timestamped default |

**Scenarios shipped:** `small` (~110 stories), `medium` (~1,000), `large` (~1,236 — 75%), `css-only` (0 — verifies CSS-blind), `regex-aliased` (0 — verifies opaque-leaf).

**Output:** appends a JSONL row per scenario × run to `scripts/eval/inner-loop/results/<timestamp>.jsonl` (or `--out <file>`). Each row contains: `rawDiff`, `groundTruth`, `payload` (modified/affected/cssAffected/projectShape), `agentRun` (model, prompt, effort, turns, cost, durations, input/output/cache tokens, message-trace, raw output, clusters with stories), `scores` (recall, precision, clusterPurity, hallucinationCount, missingCount).

```bash
# Token cost across runs:
cat scripts/eval/inner-loop/results/*.jsonl \
  | jq -r '[.scenario, .payload.estimatedTokens, .agentRun.costUsd, .scores.recall] | @tsv'
```

**Why this harness exists:** so you can re-run the eval after every prompt tweak, model change, or change-detection improvement, and watch quality / cost trend over time. The JSONL output accumulates so historical comparison is just `jq`.

---

## 3a. `prompts/categoriser-signature.md` — signature-based prompt variant (Experiment A.4)

**Location:** `scripts/eval/inner-loop/prompts/categoriser-signature.md`

**Why it exists:** the original `categoriser.md` prompt asks the agent to enumerate every story across clusters. At cascade scale (>1K stories) this generates ~30–40K output tokens that the SDK never finishes streaming — calls hang indefinitely with no error. The signature prompt asks for cluster *signatures* (prefix/regex/ids patterns) instead. Output drops to <1K tokens; the deterministic `expandSignatures()` helper assigns every input story to a cluster based on first-match. **Solves the cascade-scale hang completely.**

**Run with:** `--prompt signature` flag on `run.ts`.

**Verified live:** small/medium/large all complete in 14–18s with recall=1, precision=1, purity 0.17–0.75 (low purity at cascade scale is namespace-prefix-based and reflects that the cascade legitimately spans namespaces, not that the agent is wrong).

---

## 3b. `css-blast-experiment.ts` — CSS blast-radius synthesis prototype (Experiment C)

**Location:** `scripts/eval/inner-loop/css-blast-experiment.ts`

**What it does:** runs Storybook's real `DependencyGraphBuilder` on the dogfood; for each probe `.css` file, finds sibling JS/TS files in the same directory, looks up their importing stories via the reverse index, and unions the result. This is the deterministic gap-filler for change-detection's CSS-blindness (verified empirically — change-detection emits 0 statuses for CSS edits).

**Run:**

```bash
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/css-blast-experiment.ts
```

**Output:** prints to stdout + writes `scripts/eval/inner-loop/results/css-blast-radius.json`. Shape: `{ probes, results: [{ changedCssFile, siblingFiles, importingStories, perSibling }], caveat }`.

**Known precision limit:** when many CSS files share a directory with the same JS siblings (e.g. `addons/pseudo-states/src/stories/`), all CSS files synthesise the same affected story set. Refinement: filter siblings by base-name match (`button.css → Button.tsx`). Documented in the JSON output's `caveat` field.

**Customise probes:** edit the `probes` array at the top of the file.

---

## 3c. `module-graph-experiment.ts` — module-graph empirical characterisation (Round-2 I.1)

**Location:** `scripts/eval/inner-loop/module-graph-experiment.ts`

**What it does:** builds the full reverse index for the dogfood and reports the *distribution* of importer counts (rather than `cd-experiment.ts`'s hand-picked probes). Outputs:
- Blast-radius histogram (1, 2-5, 6-10, 11-50, 51-100, 101-500, 501-1000, 1000+)
- Depth distribution (edges per depth tier)
- `|modified|` distribution (how many stories tie at the lowest depth — i.e. would all become `modified` if the file were edited)
- Top-50 files by importer count

**Run:**

```bash
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/module-graph-experiment.ts
```

**Output:** prints to stdout + writes `scripts/eval/inner-loop/results/module-graph.json`.

**Headline findings (current dogfood):** 67.9% of files have ≤10 importers (good case); 21.3% have >100 (cascade-prone); 0% have >500 at the file level. **70.4% of edits resolve to a single `modified` story** — the deterministic baseline is sufficient most of the time.

**Note on units:** counts are *story-file* counts, not *story-ID* counts. Multiply by ~3-7 for typical story-ID totals (each story file has multiple named exports).

---

## 3c-bis. `deterministic-baselines.ts` — Experiment O: deterministic clustering

**Location:** `scripts/eval/inner-loop/deterministic-baselines.ts`

**What it does:** reads every `*.jsonl` in `results/`, computes two deterministic clustering baselines (namespace-prefix and shared-changed-file) for each scenario's payload, scores them with the same `score()` used for the LLM, and writes a JSON the report consumes.

**Run:**

```bash
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/deterministic-baselines.ts
```

**Output:** prints per-scenario comparison + writes `results/deterministic-baselines.json`.

**Critical reading note:** `clusterPurity` is namespace-based, so the namespace baseline trivially scores 1.0 — the honest signal is **cluster count**. Namespace baseline gives 1 (degenerate) to 165 (unusable) clusters; LLM gives 5–7 (UX-usable). The LLM's value is consolidation, not clustering quality.

---

## 3c-ter. `replay-real-commits.ts` — Experiment L: real-world changeset replay

**Location:** `scripts/eval/inner-loop/replay-real-commits.ts`

**What it does:** picks recent dogfood commits via `git log origin/next`, applies each commit's diff IN REVERSE (`git apply -R`) so change-detection sees a working-tree-vs-HEAD diff equivalent to "undo this commit only". The cascade fired is the same as the original commit's cascade. Runs the signature-prompt categoriser on each, scores it, computes deterministic-baseline comparisons, reverts.

**Run:**

```bash
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/replay-real-commits.ts --max 25 --out replay-real.jsonl
```

**Flags:**

| flag | values | what it does |
|---|---|---|
| `--max` | int (default 12) | cap on number of commits attempted |
| `--out` | filename | output JSONL filename in `results/` |
| `--model` | SDK model id (default `claude-sonnet-4-6`) | override agent model |
| `--effort` | `low`/`medium`/`high`/`max` (default `low`) | reasoning effort |

**Output:** appends a JSONL row per commit (success or skip) to `results/<filename>`. Rows include: commit metadata, ground-truth cascade, agent run details, scores, signature-quality, deterministic-comparison.

**Skip reasons** (logged per commit):
- `apply-failed` — patch context drifted because of later commits touching the same files. Common on feature branches that heavily refactor a small set of files.
- `empty-cascade` — commit only touched files outside the change-detection module graph (scripts/, build configs, etc.).
- `agent-failed` — SDK parse error.

Typical success rate on this branch is ~30%. On a less-active branch it would be higher. The runner is robust: skips don't crash, working tree is restored after every attempt.

**Why this script exists:** synthetic edits don't reflect the shape of real commits (multi-file, mixed types, semantic intent). Real-commit replay is the closest we get to "would this work in production?" without VRT-based ground truth.

---

## 3c-quat. `tied-distance-experiment.ts` — Round-2 I.3: tied-distance distribution

**Location:** `scripts/eval/inner-loop/tied-distance-experiment.ts`

**What it does:** for every file in the dogfood reverse index, counts how many story files tie at the *minimum* import depth (=`|modified|` if that file is edited). Outputs the distribution: mean, median, p75/p90/p95/p99, max; plus mean-when-tied / median-when-tied conditional on ≥2 ties.

**Run:**

```bash
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/tied-distance-experiment.ts
```

**Output:** `results/tied-distance.json`. Key finding: 70.4% of files produce exactly 1 modified story, but the tail goes to 262.

---

## 3c-quin. `barrel-share-experiment.ts` — Round-2 I.4: barrel-file false-cascade share

**Location:** `scripts/eval/inner-loop/barrel-share-experiment.ts`

**What it does:** classifies every file in the reverse index as barrel (`*/index.ts(x)`) or non-barrel, sums up importer-edges in each category, lists top-20 barrels by importer count, and projects barrel-share for each synthetic edit scenario.

**Run:**

```bash
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/barrel-share-experiment.ts
```

**Output:** `results/barrel-share.json`. Key finding: barrels are only 7.3% of cascade edges; the "exclude barrels" heuristic would NOT cut the bulk of cascade noise.

---

## 3c-sex. `failure-modes-experiment.ts` — Round-2 N: failure-mode taxonomy

**Location:** `scripts/eval/inner-loop/failure-modes-experiment.ts`

**What it does:** exercises every library-level failure path (parse error, empty clusters, invalid regex signature, missing catch-all, shadowed cluster, hallucinated IDs, duplicate IDs, etc.) plus documents network/SDK failure modes. Does NOT spend API tokens.

**Run:**

```bash
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/failure-modes-experiment.ts
```

**Output:** `results/failure-modes.json` + per-probe pass/fail summary. Exits non-zero if any library-level probe regresses.

---

## 3d. `build-report.ts` — HTML report generator

**Location:** `scripts/eval/inner-loop/build-report.ts`

**What it does:** reads every `*.jsonl` in `results/`, plus `css-blast-radius.json` and `module-graph.json` if present, and renders a single self-contained HTML report.

**Run:**

```bash
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/build-report.ts
# or with custom output:
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/build-report.ts --out custom.html
```

**Output:** writes `scripts/eval/inner-loop/results/report.html` (default) or `--out <path>`. Open in any browser.

**Sections:**
1. **Overview** — KPIs (total cost, fresh+cached input tokens, output tokens, models, prompt variants), per-scenario aggregate table with color-coded recall/precision/purity.
2. **Prompt comparison** — side-by-side averages per scenario for `enumerate` vs `signature` (only renders for scenarios that have runs of both variants).
3. **Variance analysis** — for any (scenario × model × prompt × effort) bucket with ≥2 runs: range of recall/precision/purity/cluster count/duration/cost, plus pairwise cluster-content Jaccard similarity (best-pair-match averaged), with drift flags (`stable`/`drifts`/`unstable`).
4. **Determ baselines** (Round-2 §O) — namespace and shared-files clustering vs LLM, with cluster-count colour coding (UX-usable / borderline / unusable).
5. **Real commits** (Round-2 §L) — replay summary across recent dogfood commits with cascade-bucket aggregation (≤50 / 51-500 / >500 stories) and per-commit detail.
6. **Module graph** — histograms from `module-graph-experiment.ts` (blast-radius distribution, depth tiers, `|modified|` distribution, top-50 fan-in) + interactive force-directed graph.
7. **CSS blast** — output of `css-blast-experiment.ts`.
8. **Run detail** — every individual JSONL row, grouped by scenario, in a collapsible card. First run per scenario is expanded by default (the one with agent data, not the baseline-only row). Each card includes: headline KPIs (cascade, payload, cost, duration, clusters, recall, purity); a **file dependency graph** with three layout modes (Summary aggregates cluster bubbles around the changed file; Full DAG is the layered Graphviz-style view changed-file → component-files → story-files; Force is the original force-directed view, best for small graphs); hover any node to highlight its full dependency neighbourhood; click a story-file node for cluster details; click a cluster name in the legend to filter the graph to just that cluster's subgraph; edit & raw diff; ground-truth modified/affected story IDs; SDK message-type counts; raw agent output; expandable per-cluster (id, rationale, representative story, full member list).

**Re-run after:** any new run, prompt change, or model change. The report aggregates everything in `results/` automatically.

---

## 3e. End-to-end recipe for reproducing the round-1 + round-2 findings

```bash
# 1. Start Storybook UI on this branch — the probe plugin and HMR fix are
#    already wired in via valentin/before-after + the in-tree
#    statusProbePlugin registered in preset.ts. No patches required.
eval "$(fnm env --shell bash)" && fnm use 22.22.1
git checkout yann/story-review-project-analysis
yarn install
yarn nx compile addon-before-after
(cd code && yarn storybook:ui &) && sleep 30  # wait for UI

# 2. Run experiments A/B/C (~20 minutes total, ~$0.50 in API costs)
# A: cascade-scale agent eval with signature prompt
node --experimental-transform-types --no-warnings scripts/eval/inner-loop/run.ts \
  --prompt signature --effort low --out exp-A.jsonl

# B: variance — small scenario × 5
node --experimental-transform-types --no-warnings scripts/eval/inner-loop/run.ts \
  --scenario small --prompt signature --effort low --runs 5 --out exp-B-variance.jsonl

# C: CSS blast-radius prototype
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/css-blast-experiment.ts

# Round-2 I.1: module-graph histogram
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/module-graph-experiment.ts

# 3. Build the report
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/build-report.ts

# 4. Open the report
open scripts/eval/inner-loop/results/report.html
```

---

## 4. Patches for the addon-before-after PR

**Location:** [`project-documents/questions/appendix/patches/`](questions/appendix/patches/README.md)

Two small fixes captured as patch files for the addon-before-after PR:

- **`02-changes-page-hmr-fix.patch`** — full fix for the `Changes (0)` bug after page reload. Subscribes directly to `experimental_getStatusStore(...).onAllStatusChange` and adds defensive 50/200/500ms retry-reads. Verified live.
- **`03-preset-probe-plugin.patch`** + **`04-status-probe-plugin.ts.new`** — adds the `/_status_/change-detection` middleware needed by the inner-loop eval harness. Apply together.

Apply with `git apply` from repo root on `yann/story-review-project-analysis`. See the [patch README](questions/appendix/patches/README.md) for the full sequence.

---

## What I deliberately did NOT include in scripts

These came up during investigation but live as documentation rather than runnable scripts:

- **HMR-storm reproduction recipe** — see [Page 3 §"Three known bugs"](questions/03_TECHNICAL.md) and the round-5 section of [`appendix/INVESTIGATION_FINDINGS.md`](questions/appendix/INVESTIGATION_FINDINGS.md).
- **env=before iframe correctness verification** — performed live; documented in [`appendix/INVESTIGATION_FINDINGS.md`](questions/appendix/INVESTIGATION_FINDINGS.md) §20-21.

---

## Where everything lives

```
project-documents/
├── INNER_LOOP.md                          ← project pitch (input)
├── MAIN_CONVERSATION.md                   ← transcript (input)
├── image.png                              ← flow diagram (input)
├── RUNNING.md                             ← THIS FILE
└── questions/
    ├── 00_README.md                       ← Notion page 1 — index + headlines
    ├── 01_SCOPE.md                        ← Notion page 2 — scope + non-goals
    ├── 02_DETERMINISTIC_VS_AI.md          ← Notion page 3 — split & spine
    ├── 03_TECHNICAL.md                    ← Notion page 4 — architecture & bugs
    ├── 04_UX_AND_EVAL.md                  ← Notion page 5 — UX & eval methodology
    └── appendix/
        ├── INVESTIGATION_FINDINGS.md      ← full empirical record (5 rounds)
        ├── cd-experiment.ts               ← script #1
        ├── token-cost-experiment.ts       ← script #2
        └── patches/
            ├── README.md
            ├── 02-changes-page-hmr-fix.patch
            ├── 03-preset-probe-plugin.patch
            └── 04-status-probe-plugin.ts.new

scripts/eval/
├── eval.ts                                ← existing story-writing eval
├── README.md                              ← existing
└── inner-loop/                            ← agent eval harness
    ├── README.md
    ├── run.ts                             ← agent-eval entry point (#3)
    ├── scenarios.ts
    ├── css-blast-experiment.ts            ← Experiment C (#3b)
    ├── module-graph-experiment.ts         ← Round-2 I.1 (#3c)
    ├── deterministic-baselines.ts         ← Round-2 O (#3c-bis)
    ├── replay-real-commits.ts             ← Round-2 L (#3c-ter)
    ├── tied-distance-experiment.ts        ← Round-2 I.3 (#3c-quat)
    ├── barrel-share-experiment.ts        ← Round-2 I.4 (#3c-quin)
    ├── failure-modes-experiment.ts       ← Round-2 N (#3c-sex)
    ├── build-report.ts                    ← HTML report generator (#3d)
    ├── lib/
    │   ├── storybook-client.ts            ← change-detection probe + poll
    │   ├── edit-fixture.ts                ← apply/revert synthetic edits
    │   ├── build-payload.ts               ← `get_change_context` payload + storyToFile
    │   ├── estimate-tokens.ts             ← fast token estimator
    │   ├── invoke-agent.ts                ← SDK call + signature/enumerate + --trace
    │   ├── expand-signatures.ts           ← signature → cluster expansion
    │   ├── signature-quality.ts           ← Round-2 J (catch-all, repr-valid, specificity)
    │   ├── css-blast-radius.ts            ← Experiment C lib
    │   ├── deterministic-clusters.ts      ← Round-2 O lib (namespace + shared-files)
    │   └── score.ts                       ← recall / precision / purity
    ├── prompts/
    │   ├── categoriser.md                 ← original (enumerate — hangs at cascade)
    │   └── categoriser-signature.md       ← cascade-safe (cluster signatures only)
    └── results/                           ← JSONL output + report.html (gitignored)
        ├── *.jsonl                        ← per-run agent eval data
        ├── css-blast-radius.json          ← Experiment C output
        ├── module-graph.json              ← Round-2 I.1 (incl. forwardEdges for graph viz)
        ├── tied-distance.json             ← Round-2 I.3 output
        ├── barrel-share.json              ← Round-2 I.4 output
        ├── failure-modes.json             ← Round-2 N output
        ├── rationale-fidelity.json        ← Round-2 K output (hand-labelled)
        ├── deterministic-baselines.json   ← Round-2 O output
        ├── replay-real-*.jsonl            ← Round-2 L output (per-commit)
        └── report.html                    ← self-contained HTML report (gitignored)
```
