# Inner-loop agent eval

Evaluates an AI agent's ability to categorise/recommend stories from a real Storybook UI's change-detection output. Sibling to the existing `scripts/eval/eval.ts` (which grades story-writing benchmark trials) — this one targets the **dogfood Storybook UI** running on `localhost:6006`.

Reuses the same `@anthropic-ai/claude-agent-sdk` pattern as `scripts/eval/lib/agents/claude-code.ts`, so it inherits subscription-based auth (no `ANTHROPIC_API_KEY` needed if you have Claude Code installed and authenticated locally).

## What it does

For each scenario:

1. Asserts that Storybook UI is reachable on `localhost:6006`.
2. Applies a deterministic synthetic edit to a known file.
3. Reads the live change-detection status snapshot via the `/_status_/change-detection` middleware (provided by the addon-before-after probe patch — see [Setup](#setup)). Falls back to a manual DevTools probe file if the endpoint isn't available.
4. Builds the proposed `get_change_context` MCP-tool payload.
5. Estimates token count of the payload.
6. *Optionally* invokes Claude with the categoriser prompt.
7. Scores the agent's output (recall / precision / cluster purity).
8. Reverts the edit.
9. Appends a JSONL row to `results/`.

## Scenarios shipped

| name | edit | measured cascade | hypothesis |
|---|---|---|---|
| `small` | `Sidebar.tsx` 1-line const rename | 116 stories | Bounded cascade in manager namespace |
| `medium` | `Button.tsx` import comment | 1,025 stories | Component-tree-wide cascade |
| `large` | `theming/index.ts` add type-only line | 1,236 stories (75%) | Worst-case string-aliased shared utility |
| `css-only` | `bundle-analyzer/index.css` colour change | 0 (CSS-blind) | Verify the gap; agent should fall back to raw diff |
| `regex-aliased` | `core/src/test/expect.ts` comment | 0 (opaque-leaf) | Verify the gap; storybook/test is regex-aliased |

## Setup

The eval needs Storybook UI running with the `/_status_/change-detection` probe endpoint exposed. On `yann/story-review-analysis`:

```bash
# Use fnm if `node` isn't on PATH (the repo's .nvmrc is 22.22.1)
eval "$(fnm env --shell bash)" && fnm use 22.22.1

# Apply the addon patches (HMR fix + probe middleware)
git apply project-documents/questions/appendix/patches/02-changes-page-hmr-fix.patch
git apply project-documents/questions/appendix/patches/03-preset-probe-plugin.patch
cp project-documents/questions/appendix/patches/04-status-probe-plugin.ts.new \
   code/addons/before-after/src/node/status-probe-plugin.ts

yarn install
yarn nx compile addon-before-after
cd code && yarn storybook:ui
# Storybook now exposes http://localhost:6006/_status_/change-detection
```

If you skip the patch, the harness prints a DevTools probe snippet on first scenario — paste it into the Storybook tab's console, save the printed JSON to `/tmp/sb-cd-statuses.json`, and re-run.

> **Run from the repo root**, not from `code/`. The harness uses workspace-relative imports.

## How to run

Without an agent (just measures payload size + ground truth):

```bash
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/run.ts --baseline-only
```

With Claude — **use the signature prompt for any non-trivial scenario** (the default `enumerate` prompt hangs on medium/large because it generates ~30K output tokens):

```bash
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/run.ts --prompt signature --effort low
```

Variance measurement (5 repeated runs of one scenario):

```bash
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/run.ts \
    --scenario small --prompt signature --effort low --runs 5 --out variance.jsonl
```

Diagnose hangs / inspect SDK message stream with timestamps:

```bash
node --experimental-transform-types --no-warnings \
  scripts/eval/inner-loop/run.ts --scenario medium --prompt signature --trace
```

### All flags

| flag | values | what it does |
|---|---|---|
| `--scenario` | `small`/`medium`/`large`/`css-only`/`regex-aliased` | run only the named scenario (default: all) |
| `--baseline-only` | — | skip agent invocation; measure tokens / ground truth only |
| `--runs` | int (default 1) | repeat each scenario N times (for variance measurement) |
| `--no-cleanup` | — | don't revert the synthetic edit at end (debug-only) |
| `--verbose` | — | print one-line per assistant message |
| `--trace` | — | print every SDK message with elapsed-time prefix (`[+10s] assistant [thinking]`) |
| `--model` | SDK model id (default `claude-sonnet-4-6`) | override agent model |
| `--effort` | `low`/`medium`/`high`/`max` (default `medium`) | reasoning effort |
| `--prompt` | `enumerate`/`signature` (default `enumerate`) | **prompt variant — see below** |
| `--out` | filename | write JSONL to `results/<filename>` instead of timestamped default |

### Prompt variants

- **`enumerate`** (the original) — agent assigns every input story to a cluster by listing IDs. Output scales O(N stories) ≈ 30–40K tokens at the cascade scale; **call hangs and never returns** above ~600 stories. Suitable only for `small` scenario.
- **`signature`** — agent emits cluster *signatures* (prefix/regex/ids patterns) describing which stories belong; deterministic `expandSignatures()` helper assigns every input story to the first matching signature. Output stays under 1K tokens regardless of cascade size. **Use this for medium/large.** Verified to complete in 14–18s with recall=1, precision=1.

## Output

Each run appends a JSONL row to `results/<timestamp>.jsonl` (or `--out <file>`):

```json
{
  "timestamp": "2026-...",
  "scenario": "small",
  "edit": { "path": "code/core/src/manager/components/sidebar/Sidebar.tsx" },
  "rawDiff": "@@ -1,3 +1,3 @@\n-export const DEFAULT_REF_ID = 'storybook_internal';\n+export const DEFAULT_REF_ID = 'storybook_internal_eval';",
  "groundTruth": { "modified": 51, "affected": 65, "total": 116, "withinExpectedRange": true },
  "payload": {
    "totalSizeBytes": 10935, "estimatedTokens": 3641,
    "modified": ["..."], "affected": ["..."], "newStories": [], "cssAffected": [],
    "projectShape": { "totalStories": 1637, "topNamespaces": [...] }
  },
  "agentRun": {
    "model": "claude-sonnet-4-6", "promptVariant": "signature", "effort": "low",
    "turns": 1, "costUsd": 0.0119, "durationS": 11.2, "durationApiS": 9.8,
    "inputTokens": 3, "outputTokens": 629, "cacheReadTokens": 22148,
    "messageTrace": { "typeCounts": {...}, "firstMessageMs": 1900, "lastMessageMs": 14800, "totalMessages": 4, "estimatedOutputTokens": 555 },
    "rawOutput": "{\"clusters\":[...]}",
    "clusterCount": 6,
    "clusters": [
      { "id": "sidebar-imports", "rationale": "...", "representative": "...", "storyCount": 30, "stories": ["..."] }
    ]
  },
  "scores": { "recall": 1.0, "precision": 1.0, "clusterPurity": 0.75, "groundTruthSize": 116, "agentOutputSize": 116, "duplicateCount": 0, "hallucinationCount": 0, "missingCount": 0 },
  "runIndex": 0, "runsTotal": 5
}
```

Aggregate over time:

```bash
cat scripts/eval/inner-loop/results/*.jsonl \
  | jq -r '[.scenario, .payload.estimatedTokens, .agentRun.costUsd, .scores.recall] | @tsv'
```

## Sibling experiments

Eight companion scripts live next to `run.ts` and share the same `lib/`:

| script | what it does | output |
|---|---|---|
| [`css-blast-experiment.ts`](css-blast-experiment.ts) | Round-1 C — synthesise affected stories for CSS files (change-detection is structurally CSS-blind). Walks the dogfood reverse index, finds JS/TS siblings of each probe `.css` file, unions their importing stories. | `results/css-blast-radius.json` |
| [`module-graph-experiment.ts`](module-graph-experiment.ts) | Round-2 I.1 — characterises the dogfood's reverse-index distribution (blast-radius histogram, depth tiers, `\|modified\|` distribution, top-50 fan-in). Also dumps the **forward dependency graph** (file → imports) used by the HTML report's file-level visualisation. | `results/module-graph.json` |
| [`tied-distance-experiment.ts`](tied-distance-experiment.ts) | Round-2 I.3 — for each file in the reverse index, counts how many stories tie at the minimum import depth (=`\|modified\|` if the file is edited). Outputs distribution stats. | `results/tied-distance.json` |
| [`barrel-share-experiment.ts`](barrel-share-experiment.ts) | Round-2 I.4 — identifies barrel files (`*/index.ts(x)`), measures their share of cascade edges, top-20 by importer count, and projects per-synthetic-scenario barrel-share. | `results/barrel-share.json` |
| [`failure-modes-experiment.ts`](failure-modes-experiment.ts) | Round-2 N — exercises every library-level failure path (parse error, empty clusters, invalid regex signature, missing catch-all, shadowed cluster, hallucinated IDs, duplicates, etc.) plus documents network/SDK paths. | `results/failure-modes.json` |
| [`deterministic-baselines.ts`](deterministic-baselines.ts) | Round-2 O — scores namespace-prefix and shared-changed-file clusterings against the LLM (using the same `score()` function). Critical reading note: `clusterPurity` is namespace-based, so the namespace baseline trivially scores 1.0 — the honest signal is **cluster count**. | `results/deterministic-baselines.json` |
| [`replay-real-commits.ts`](replay-real-commits.ts) | Round-2 L — replays recent dogfood commits via the reverse-patch trick (`git apply -R`). Skips cleanly on apply-failures or empty cascades. Each successful commit produces a JSONL row with full cluster info, signature-quality, and deterministic comparison. | `results/replay-real-*.jsonl` |
| [`build-report.ts`](build-report.ts) | Reads every `*.jsonl` + the JSON outputs above; renders a single self-contained HTML with overview, prompt-comparison, variance analysis, deterministic baselines, real-commit replays, module-graph histograms with interactive force-directed view, CSS-blast detail, and per-run cards. Each per-run card includes a **file dependency graph** with three layout modes (Summary / Full DAG / Force), hover-neighbourhood highlight, and a cluster-filter that re-lays out the subgraph. | `results/report.html` |

Run any of them with the same `node --experimental-transform-types --no-warnings <path>` form. See [project-documents/RUNNING.md](../../../project-documents/RUNNING.md) sections 3a–3e for the full one-shot recipe.

## Layout

```
scripts/eval/inner-loop/
├── README.md                       — this file
├── run.ts                          — agent eval entry point
├── scenarios.ts                    — 5 synthetic-edit fixtures
├── css-blast-experiment.ts         — Round-1 C
├── module-graph-experiment.ts      — Round-2 I.1
├── tied-distance-experiment.ts     — Round-2 I.3
├── barrel-share-experiment.ts     — Round-2 I.4
├── failure-modes-experiment.ts    — Round-2 N
├── deterministic-baselines.ts      — Round-2 O
├── replay-real-commits.ts          — Round-2 L
├── build-report.ts                 — HTML report generator
├── lib/
│   ├── storybook-client.ts         — talks to Storybook UI / probe endpoint
│   ├── edit-fixture.ts             — apply / revert edits idempotently
│   ├── build-payload.ts            — construct get_change_context bundle + storyToFile
│   ├── estimate-tokens.ts          — mirrors @storybook/addon-mcp tokeniser
│   ├── invoke-agent.ts             — Claude SDK call (handles enumerate/signature, --trace)
│   ├── expand-signatures.ts        — signature-prompt → cluster expansion
│   ├── signature-quality.ts        — Round-2 J (catch-all share, repr-valid, specificity)
│   ├── css-blast-radius.ts         — Round-1 C lib
│   ├── deterministic-clusters.ts   — Round-2 O lib (namespace + shared-files)
│   └── score.ts                    — recall / precision / cluster purity
├── prompts/
│   ├── categoriser.md              — original (enumerate stories per cluster — hangs at cascade)
│   └── categoriser-signature.md    — cascade-safe (cluster signatures only)
└── results/                        — JSONL + JSON output + report.html (gitignored)
```

## Caveats

- Treats the deterministic change-detection output as ground truth for the agent's recall/precision. This matches the project's framing — the agent's job is to *organise* what change-detection found, not to find more. For "true" visual-change ground truth via VRT, see Page 4 of the project docs.
- Token count is an estimate. For exact counts, the SDK reports `cost` and `usage` directly.
- Latency varies. Run the same scenario 3+ times for a stable median.

## Why this lives under `scripts/eval/` and not under `project-documents/`

The original implementation lived in `project-documents/questions/appendix/agent-eval/` because that's where the investigation work happened. It's been moved here so it (a) reuses the existing eval infrastructure (SDK auth, agent driver patterns), (b) lives in proper dev infrastructure that survives branch operations on `next`, and (c) is discoverable next to its sibling story-writing eval.
