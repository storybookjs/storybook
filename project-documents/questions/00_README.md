# Inner Loop Agentic Diff — Questions & Decisions

Five Notion-shaped pages distilling what to decide before the project starts. Every recommendation is grounded in real numbers from the running prototype — see [`appendix/INVESTIGATION_FINDINGS.md`](appendix/INVESTIGATION_FINDINGS.md) for the full empirical record and [`appendix/cd-experiment.ts`](appendix/cd-experiment.ts) for the reproducible measurement script.

## Reading order

1. **[Scope](01_SCOPE.md)** — what we're building, what we're not building, hard non-goals.
2. **[Deterministic vs AI](02_DETERMINISTIC_VS_AI.md)** — what the project can do without an agent, what genuinely needs one. *Read this before the technical page.*
3. **[Technical](03_TECHNICAL.md)** — review page architecture, MCP tool surface, status taxonomy.
4. **[UX & Eval](04_UX_AND_EVAL.md)** — page design, user-session methodology, recall threshold.

## Pre-kickoff decisions (the only blockers)

These five questions need answers before week 1, in priority order. Everything else can be decided during the project.

1. **Two tracks or one?** — review page (engineering) and agent shortlist (research) on separate success bars. ([Page 1, Q1](01_SCOPE.md#two-tracks-or-one-project))
2. **Iteration-1 deliverable** — review page + simple deterministic MCP tool, no agent. Agent is iteration 2 if user sessions ask for it. ([Page 1, Q3](01_SCOPE.md#what-is-the-iteration-1-deliverable))
3. **Recall threshold to ship** — pick a number now, not after measurement. ≥95% with Chromatic-as-backstop messaging is realistic. ([Page 4, Q5](04_UX_AND_EVAL.md#what-recall-threshold-defines-ship))
4. **Eval-time VRT** — internal-only VRT for ground-truth labelling is allowed. The "no local VRT" no-go is about the product. ([Page 4, Q6](04_UX_AND_EVAL.md#how-do-we-get-ground-truth))
5. **Baseline strategy** — session-pinned at merge-base, not git HEAD. Required for agentic loops. ([Page 3, Q2](03_TECHNICAL.md#what-is-the-before-baseline))

## Headline opinions (full reasoning in each page)

- **Reframe the agent's role from filter to categorizer + presenter.** "Pick K from N" hides things and is a false-negative cliff. "Group all N and explain each cluster" eliminates that and is a much weaker reasoning task.
- **Cluster output must be O(K) signatures, not O(N) story IDs.** *Round 2:* enumerate-prompt hangs above ~600 stories due to output-token overflow; signature-prompt completes in 14–18s at any scale and produces deterministically-expandable patterns. This is now the canonical agent design.
- **Most of what people imagine the agent doing is actually deterministic.** Reverse-index lookups, CSS-file blast-radius, raw-diff retrieval, status assignment — all already exist or are short additions. *Round 2:* module-graph histogram shows 70% of edits resolve to a single `modified` story → the deterministic baseline is genuinely good in the common case. The agent earns its place specifically on the 21% high-fan-in cascade.
- **Iframe pooling is iteration-1 work.** Empirically each iframe costs ~8 MB browser memory. The 75%-cascade scenario in compare mode would crash a tab. Confirmed live.
- **The agent must consume raw git diff**, not just change-detection statuses. CSS, type-only files, regex-aliased barrels, and node_modules are all systematically invisible to change-detection.
- **The 10.5 release branch cuts at end of week 6.** No buffer.

## Headline non-goals (so they don't get re-debated)

- Per-test Vitest coverage. Genuinely unsolved in 2026, even outside Storybook.
- Local production VRT (per pitch).
- Webpack-based builder support in iteration 1.
- Solving "find references across business logic" — industry-wide problem, not Storybook's to solve.
- Cost UI in iteration 1.

## Tier-1 architecture risk verified

Five concerns that could have invalidated the project's premise — all resolved positively. **Round 2 (May 10) added empirical answers to the two remaining unknowns: output-token behaviour at cascade scale and run-to-run variance.**

| Concern | Outcome |
|---|---|
| **Input token cost** of agent invocation | Categoriser approach: 2.7K (typical) → 22K (cascade) → 63K (worst case). Filter approach blows 200K context at 611 stories. Decisive vindication of categoriser framing. |
| **Output token cost / SDK hang at cascade** | **Round 2:** the original `enumerate` prompt asks the model to list every story per cluster — at >600 stories this generates 30K+ output tokens that never finish streaming. The new **`signature` prompt variant** ([categoriser-signature.md](../../scripts/eval/inner-loop/prompts/categoriser-signature.md)) asks for cluster *signatures* (prefix/regex/ids patterns); deterministic [`expandSignatures()`](../../scripts/eval/inner-loop/lib/expand-signatures.ts) expands. Output drops to <1K tokens regardless of cascade size. **All 5 scenarios complete in 14–18s on Sonnet, $0.06–0.18 each.** |
| **Run-to-run variance** | **Round 2:** 6 runs of `small`/Sonnet/signature/low → recall=1.000 stable, precision=1.000 stable, purity 0.629–0.750 (8% drift), cluster count 5–6, **pairwise cluster-content Jaccard = 0.707** (good). Cost drops 4× on runs 2+ (prompt cache hit). Variance is well-bounded for shipping. |
| **env=before cold-start latency** | No measurable overhead vs env=after. Both ~150ms loadMs / ~670ms render. |
| **Play / decorators / args correctness** | Verified identical between before/after iframes. Play function side-effects fire correctly in env=before. |
| **node_modules / addon behavior** | Vite optimizeDeps cache shared between both envs; addons run at *currently-installed* version, not HEAD. Document as caveat. |
| **End-to-end agent write path** | Verified: `experimental_getStatusStore('storybook/agent-review').set([...])` writes propagate via UniversalStore intact, including cluster-id + rationale in `data` field. All primitives exist; only enum extension + new MCP tools needed. |

**Net conclusion: no architectural blocker.** Every Tier-1 concern is either resolved positively or has a working design with measured numbers. The project is implementable as the docs describe.

## Round 2 (May 10–11) — empirical findings that change project shape

Six findings that didn't exist when the questions docs were written and should reshape the iteration-1 plan:

1. **The "feature works fine without an agent" case is the dominant case.** Module-graph histogram on the 1,438-file dogfood reverse index ([`module-graph-experiment.ts`](../../scripts/eval/inner-loop/module-graph-experiment.ts)) shows **70.4% of edits resolve to a single `modified` story**; 67.9% of files have ≤10 importers. The cascade case is real but minority — only 21.3% of files have >100 importers, none have >500 at the file level. The "iteration 1 = deterministic-only is enough" hypothesis from Page 1 has empirical legs.
2. **The output-token-budget design unlock.** Signature prompts work and enumerate prompts don't, period. Any iteration-2 agent design must emit O(K) cluster definitions, not O(N) story IDs.
3. **The LLM's actual value is *consolidation*, not clustering.** Round-2 §O measured deterministic baselines (namespace-prefix and shared-changed-file). Namespace baseline produces 1 (degenerate) to 118+ (unusable) clusters; the LLM consistently produces **2–7 UX-usable clusters** on cascades from 12 to 1,236 stories. The simpler iteration-2 design unlocked: generate cluster *content* deterministically by namespace, use the LLM only to (a) merge over-segmented clusters, (b) write rationales. Output stays under 1K tokens; latency a few seconds; variance near-zero.
4. **Real-world commit replay confirms the synthetic findings.** Round-2 §L replayed 8 actual dogfood commits via reverse-patch trick. **Recall=1.0 and precision=1.0 across every replay** (cascades 12–1,025 stories). Purity is bimodal: 1.0 on small cascades that fit in one namespace, 0.13–0.17 on cascade-scale commits that cross namespaces. Cost ranges $0.015–$0.151 per commit.
5. **Haiku works at all scales.** Round-2 §M ran `claude-haiku-4-5-20251001` with signature/low on small/medium/large. Recall=1, precision=1 across all three; purity comparable to Sonnet; cost ~30% cheaper at cascade scale; 4–5× slower (47–80s vs 12–18s). Signature quality (catch-all share 0–18%, repr-valid 5/6 to 7/7) is on par with Sonnet. **Page 4's "downshift to deterministic-only on Haiku" recommendation is wrong** — Haiku can be the primary mode for cost-sensitive users.
6. **CSS blast-radius synthesis is high-recall, low-precision.** Prototype landed in [`lib/css-blast-radius.ts`](../../scripts/eval/inner-loop/lib/css-blast-radius.ts). Verified live: a CSS edit in `pseudo-states/src/stories/` synthesises 9 importing stories where change-detection emits 0. **Caveat:** every CSS file in the same dir produces the *same* synthesised set (we union all JS siblings). Refinement (basename matching: `button.css → Button.tsx`) noted as future work.

## Re-runnable measurement infrastructure

For complete instructions on running every script and experiment, see [`../RUNNING.md`](../RUNNING.md).

The eval-harness has expanded across Round 1 and Round 2 — eight scripts now, all reproducible from [`scripts/eval/inner-loop/`](../../scripts/eval/inner-loop/):

- **[`cd-experiment.ts`](appendix/cd-experiment.ts)** (lives in `appendix/` — pre-dates the harness) — runs Storybook's real `DependencyGraphBuilder` against the monorepo, measures blast radius for hand-picked probe files.
- **[`token-cost-experiment.ts`](appendix/token-cost-experiment.ts)** — offline token-cost projections at three cascade scales.
- **[`scripts/eval/inner-loop/run.ts`](../../scripts/eval/inner-loop/run.ts)** — the main agent-eval harness. Applies synthetic edits at known cascade scales (small=116, medium=1,025, large=1,236, css-only=0, regex-aliased=0), reads live change-detection output, builds the proposed `get_change_context` payload, optionally invokes Claude with the categoriser prompt (enumerate or signature variant), scores recall/precision/cluster purity, writes JSONL results.
- **[`module-graph-experiment.ts`](../../scripts/eval/inner-loop/module-graph-experiment.ts)** — Round-2 §I.1. Dumps the dogfood reverse-index distribution (blast-radius histogram, depth tiers, `|modified|` distribution, top-50 fan-in) + the forward dependency graph used by the file-level visualisation.
- **[`css-blast-experiment.ts`](../../scripts/eval/inner-loop/css-blast-experiment.ts)** — Experiment C. Synthesises CSS blast-radius via the reverse index.
- **[`deterministic-baselines.ts`](../../scripts/eval/inner-loop/deterministic-baselines.ts)** — Round-2 §O. Scores namespace-prefix and shared-changed-file clusterings against the LLM with the same `score()` function.
- **[`replay-real-commits.ts`](../../scripts/eval/inner-loop/replay-real-commits.ts)** — Round-2 §L. Replays recent dogfood commits via reverse-patch trick. Robust to apply-conflicts; skips cleanly.
- **[`build-report.ts`](../../scripts/eval/inner-loop/build-report.ts)** — aggregates every JSONL + JSON output in `results/` into a single self-contained HTML report (overview, prompt comparison, variance analysis, deterministic baselines, real commits, module graph with interactive force-directed view, CSS blast section, and per-run cards with **file dependency graphs** in three layout modes — Summary / Full DAG / Force — including hover-neighbourhood highlight and cluster-filter).

## What changed across the investigation

The original questions doc (now in `appendix/INVESTIGATION_FINDINGS.md`) was written from a high-level read. Five rounds of investigation produced concrete corrections — most numbers in the original guesses were wrong. These pages reflect the live measurements:

- Typical first-party file edit (`Sidebar.tsx`) → **110 stories flagged** in dogfood (6.8% of 1,613).
- String-aliased shared utility (`theming/index.ts`) → **1,212 stories flagged** (75%).
- Regex-aliased barrels (`storybook/test`) → **0** (opaque-leaf).
- CSS file edit → **0** (CSS-blind).
- Per-iframe browser memory → **~8 MB**.
- env=before path correctly serves HEAD content for both JS and CSS.

The `appendix/INVESTIGATION_FINDINGS.md` is preserved untouched as the empirical record.
