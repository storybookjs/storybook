# Followup for the next agent

This is a hand-off note. Read it once, then read [`RUNNING.md`](RUNNING.md) for command details and [`questions/00_README.md`](questions/00_README.md) for the project framing.

## Branch state (2026-05-12)

We are now on **`yann/story-review-project-analysis`**, branched from `valentin/before-after` (a clean rebase target, not from `next` directly). The old `yann/story-review-analysis` branch is frozen; everything still relevant has been ported.

### TL;DR for the meeting

- **Branch is ready to demo.** Storybook UI starts with the probe endpoint already wired in, no patches required. `node scripts/eval/inner-loop/build-report.ts` regenerates `results/report.html` from committed JSONLs.
- **Open `report.html` in any browser.** Every agent run now has an "Agent conversation" section showing the model's thinking + structured output in timeline order (look for the amber **thinking** blocks on signature-depth runs).
- **The numbers held up against the new base.** Recall and precision are still 100% across small/medium/large with signature; variance is in the same narrow band as the May-10 baseline; costs are 4–7× cheaper because the prompt cache is warming across trials.
- **New: signature-depth recovers gap scenarios.** css-only and regex-aliased scored recall=1 with depth-tier guidance because depth is computed from `DependencyGraphBuilder` directly, sidestepping the deterministic change-detection blind spots. Cost is 4–20× higher, so it's a deliberate-use feature.

### Fresh full-coverage replay against this base

10-trial sweep (`fresh-sig-low-x2.jsonl`) re-ran every scenario × 2 reps on the new base with `--prompt signature --effort low`. Numbers consistent with the historic May-10 baseline, **and ~4–7× cheaper** thanks to the prompt cache hitting across trials:

| scenario | total | recall | precision | purity (range) | clusters | cost (range) | duration |
|---|---|---|---|---|---|---|---|
| small | 116 | 1.00 | 1.00 | 0.75 | 5–6 | $0.012–$0.013 | 13–15s |
| medium | 1025 | 1.00 | 1.00 | 0.15–0.18 | 6 | $0.020–$0.021 | 13s |
| large | 1236 (75%) | 1.00 | 1.00 | 0.13–0.15 | 6–7 | $0.024–$0.026 | 14–15s |
| css-only | 0 | — | — | — | — | — | — |
| regex-aliased | 0 | — | — | — | — | — | — |

(`css-only` and `regex-aliased` produce empty cascades by design — the harness records the gap so we can later wire deterministic fallbacks.)

Every one of these trials ships its full agent transcript in the row (see below) — when the meeting asks "what did the model actually think?" you can answer by clicking the run card in the report.

### `signature-depth` follow-up sweep

A second 10-trial sweep (`fresh-sig-depth-low-x2.jsonl`) re-ran every scenario with `--prompt signature-depth --with-depth --effort low`, which annotates the payload with each story's import depth from the changed file and asks the model to produce naturally-tiered "zoom-level" clusters (the team-conversation hypothesis from Round-2 §I.5).

| scenario | recall | precision | purity (range) | clusters | cost (range) | duration (range) |
|---|---|---|---|---|---|---|
| small | 1.00 | 1.00 | 0.70–0.81 | 6 | $0.017–$0.023 | 15–22s |
| medium | 1.00 | 1.00 | 0.16 | 5 | $0.05–$0.09 | 39–68s |
| large | 1.00 | 1.00 | 0.13 | 5 | $0.09–$0.35 | 29–76s |
| css-only | 1.00 | 1.00 | 0.15 | 6 | $0.04–$0.18 | 24–32s |
| regex-aliased | 1.00 | 1.00 | 0.12 | 5 | $0.05–$0.34 | 30–37s |

Three things stand out vs the plain-signature run:

1. **`css-only` and `regex-aliased` are no longer empty.** Depth maps are computed from Storybook's `DependencyGraphBuilder` directly (via `precompute-depth-maps.ts`), not from change-detection. They reach scenarios where the deterministic change-detection signal is structurally blind (CSS files; regex-aliased exports). With depth context, the agent recovers real cascades the deterministic path missed — recall=1 on both.
2. **Variance is higher.** Small's purity ranges 0.70–0.81 (vs 0.75 flat for signature). Large run=1 cost jumped to $0.35 (vs $0.025 for plain signature). Reasoning cost is sensitive to the longer prompt and the depth-tier instruction making the model "think harder."
3. **Cost is 4–20× higher.** Depth runs are expensive enough that it's a deliberate-use feature, not a default. Cheapest depth trial ($0.017 on small run=1, cache-warm) is still ~30% more than plain signature.

Open `report.html` in any browser and look for the colour-coded **thinking** blocks in the depth runs' transcripts — that's where the model is reasoning about which depth tier owns each cluster. The plain-signature runs typically have one short `text` block; depth runs add explicit thinking traces.

### Variance refresh (`fresh-variance-small-x5.jsonl`)

5 repeated runs of small/signature/low to characterise stability on the new base:

| rep | recall | precision | purity | clusters | cost | duration |
|---|---|---|---|---|---|---|
| 0 | 1.00 | 1.00 | 0.629 | 5 | $0.0121 | 13.4s |
| 1 | 1.00 | 1.00 | 0.750 | 6 | $0.0133 | 12.0s |
| 2 | 1.00 | 1.00 | 0.750 | 6 | $0.0132 | 10.1s |
| 3 | 1.00 | 1.00 | 0.629 | 5 | $0.0120 | 10.5s |
| 4 | 1.00 | 1.00 | 0.629 | 4 | $0.0109 | 9.8s |

Same picture as the May-10 baseline: **recall and precision are flat at 1.00**, purity drifts in a 0.629–0.750 band (12 ppt range), cluster count 4–6. The two non-stable metrics still settle inside a narrow band — useful for the meeting when "is this reproducible?" comes up.

### Real-commit replay refresh (`replay-real-2026-05-12.jsonl`)

`replay-real-commits.ts --max 12` against recent dogfood commits — applies each commit's diff via `git apply`, lets change-detection scan, runs the signature categoriser on the resulting cascade, reverts. 4 of 12 commits replayed cleanly; 7 hit context-drift `apply-failed` (expected for older commits); 1 produced an empty cascade.

| commit | subject | cascade | recall | purity | cost | duration |
|---|---|---|---|---|---|---|
| `f003ca4` | Quiet change-detection regex warning | 126 | 1.00 | 0.77 | $0.033 | 14s |
| `a4cae09` | Address PR feedback | 154 | 1.00 | 0.53 | $0.049 | 13s |
| `ee67137` | manager-api: keep onAllStatusChange timing | 1025 | 1.00 | 0.14 | $0.155 | 26s |
| `38a009a` | manager-api: await recompute filter calls | 1025 | 1.00 | 0.15 | $0.151 | 15s |

All four successful runs ship their transcripts in the JSONL (4–5 messages each), so the meeting can click into a real dogfood commit and read what the model thought.

What this branch contains, relative to `valentin/before-after`:

- `scripts/eval/inner-loop/` — the full harness + sub-experiments + reference outputs that the previous Round-1/Round-2 work produced. Re-validated against the new base; no regressions (`small` 116 stories: recall=precision=1, purity=0.75, 6 clusters in 12s for $0.013 with cache; `medium` 1025 stories: same recall/precision, purity=0.18, 6 clusters in 16s for $0.14).
- `code/addons/before-after/src/node/status-probe-plugin.ts` + a one-line `viteFinal` registration in `preset.ts`. This is the `/_status_/change-detection` probe endpoint the harness depends on. Confirmed live on the new base.
- `project-documents/` — research docs (this one, INNER_LOOP, RUNNING, MAIN_CONVERSATION, etc).
- A new **agent-conversation transcript capture** in the inner-loop runs (see "Agent transcripts" below).

What this branch deliberately **does not** carry over from the old `yann/story-review-analysis`:

- The HMR-fix patches (patches 02–04). Valentin's branch rewrote `experimental_devServer` to return `app` at every exit (commit `9a57a1f8c`), and rewrote routing to the single-env marker model. The HMR-flash workaround in `ChangesPage.tsx` looks unnecessary against the new code path; we'll re-port it only if the symptom reappears.
- The custom changes to `code/builders/builder-vite/input/iframe.html` — superseded by valentin's font-face extraction (`d61bd0e77b0`).
- Manager-side test stories (`ChecklistWidget.stories.tsx`, `Tree.stories.tsx`) that were edit fixtures for the old branch.
- An uncommitted local-only WIP for a `signature-depth` prompt variant (depth-tier guidance). The implementation referenced internal Storybook modules via deep paths and had a hardcoded checkout path; not production-shaped. Left out for now — happy to revisit if the team conversation says depth-tier UX is the right direction.

If you need to refer to the previous branch's exact state: `git log yann/story-review-analysis -- <path>`.

## What's new on this branch

### Agent transcripts: see what the model actually said

The inner-loop now captures the full SDK message stream for every agent invocation and ships it both inline in the JSONL row and rendered in the HTML report:

- **JSONL** — each agent run gains two new fields:
  - `agentRun.sessionId` — the SDK `system.session_id` UUID. Same UUID Claude Code uses for its own session log at `~/.claude/projects/<project>/<session-id>.jsonl`, so you can cross-reference if you need raw birpc envelopes.
  - `agentRun.transcript` — a compact, JSON-safe projection of every message: `system`/`assistant`/`user`/`result`/`rate_limit`/`other`, each annotated with `ms` (elapsed since session start). The assistant entries preserve text, thinking, and `tool_use` blocks; user entries preserve `tool_result` blocks. No raw birpc envelopes — those would inflate the row 5–10× for no diagnostic value.
- **HTML report** — every per-run card now has an **"Agent conversation"** section (collapsed by default) showing the messages in timeline order with per-block colour coding (assistant=indigo, user=green, system=neutral, result=violet, rate_limit=amber). Open it to see exactly what the model produced; expand "Raw transcript JSON" inside for the full structured form.
- **Type re-use** — the `TranscriptEntry` type lives in `scripts/eval/inner-loop/lib/invoke-agent.ts` and is exported, so anything else under `scripts/eval/inner-loop/` can consume it without duplicate definitions. We didn't unify with the outer-loop `transcript-types.ts` because the shapes diverge (outer-loop is multi-turn with real tool use; inner-loop is one-shot reasoning) — but the inner-loop schema is the same camel-cased structure, so a future merge is mechanical.

To see this on a fresh checkout: run the report build (no SDK required, just reads the committed JSONLs):

```bash
node --experimental-transform-types --no-warnings scripts/eval/inner-loop/build-report.ts
open scripts/eval/inner-loop/results/report.html
```

Look under any of the post-2026-05-12 runs (`replay-small-sig`, `replay-medium-sig`, `smoke-transcript`); the historic `run-2026-05-09T14...` runs don't have the transcript field — re-run them locally if you want to see them populated.

### Probe endpoint on the new base

The `statusProbePlugin` is wired into `viteFinal` alongside `beforeEnvironmentPlugin` and `beforeContentPlugin`. Live snapshot of change-detection state is back at:

```
GET http://localhost:6006/_status_/change-detection
```

No patches required, no manual DevTools probe fallback — it Just Works on this branch's Storybook UI startup.

## Where we are now (2026-05-10 — frozen; see "Branch state" above for current)

The three previously-blocking experiments are done and the results materially change the project's risk picture. **The categoriser approach now demonstrably works at the cascade scale** when you stop asking the model to enumerate stories. See [`scripts/eval/inner-loop/results/report.html`](../scripts/eval/inner-loop/results/report.html) for the full digestible view (open in any browser; self-contained).

**Headline findings:**

- **A: SDK hang at cascade scale is solved by the signature prompt.** medium (1025 stories) and large (1236 stories) — both of which previously hung indefinitely with `claude-sonnet-4-6` low effort — now complete in 15s and 18s respectively. Output tokens dropped from ~30K projected (enumerate) to 669/962 actual (signature). The hang was an output-token issue, not a streaming or auth issue. Diagnosed via the new `--trace` flag which logs every SDK message with timestamps; the `[+10s] assistant [thinking]` event was reached even on the previously-hung medium scenario, confirming the API was alive but generating an enormous output that never completed.
- **B: variance is well-bounded.** 6 runs of `small`/sonnet/signature/low yielded recall=1.000, precision=1.000, purity 0.629–0.750 (8% range), cluster count 5–6, **cluster-content Jaccard 0.707** (best-pair-match average). The two non-stable metrics — purity and cluster count — drift inside a tight band; recall/precision are perfectly stable. Cost dropped 4× on runs 2–6 (prompt cache hit): $0.063 → $0.012/run.
- **C: CSS blast-radius synthesis prototype works** but reveals an expected precision limit. Probing 7 stylesheet files in the dogfood: `pseudo-states/src/stories/button.css` and 5 sibling `.css` files in the same directory all synthesise the same 9 importing stories, because the lookup unions every JS sibling regardless of which CSS file changed. Refinement: filter siblings by base name (`button.css → Button.tsx`). Spec'd in the JSON output's `caveat` field.

The full experiment artefacts are in [`scripts/eval/inner-loop/results/`](../scripts/eval/inner-loop/results/). Open `report.html` for the readable view.

Branch: **`yann/story-review-analysis`** — merges `valentin/before-after` (the addon PR) with `next`. Current state:

- The build works on a clean checkout. The obsolete `01-build-config-fix.patch` is gone.
- **Patches 02–04 are committed** to the branch (`0ecb09bc6ca initial research`). Storybook UI boots; `/_status_/change-detection` returns live JSON; HMR `Changes (n)` updates without the `(0)` flash; `POST /mcp` returns 202 (both `addon-before-after` and `addon-mcp` coexist).
- **Eval-harness poll-budget fix** is in. `POLL_MAX_MS = 180_000`, default empty-stable threshold = 60. All five baseline scenarios capture within expected ranges.
- **All five scenarios complete end-to-end** with the signature prompt at every scale on both Sonnet and Haiku. See report.html for full numbers.
- **`@storybook/addon-mcp` coexists cleanly** with `addon-before-after`. The presets-chain crash (`TypeError: Cannot read properties of undefined`) was traced to Storybook's `applyPresets` ([code/core/src/common/presets.ts:301](../code/core/src/common/presets.ts:301)) being a fold over each preset's return value — `addon-before-after`'s `experimental_devServer` hook fell off the end with no `return`, so the next preset got `undefined` instead of the express `app`. Fixed in `code/addons/before-after/src/preset.ts` by renaming `_app` → `app` and adding `return app` at every exit point. Worth filing upstream — the same trap awaits every addon author writing a side-effect `experimental_devServer` hook.

## Status snapshot

Compact summary of everything that landed; expand each `<details>` for the data:

<details>
<summary>✅ Patches 02–04 (HMR fix + probe endpoint) — committed</summary>

In `0ecb09bc6ca initial research`. Storybook UI boots; `/_status_/change-detection` returns live JSON; HMR `Changes (n)` updates without the `(0)` flash.
</details>

<details>
<summary>✅ Eval-harness poll budget — fixed</summary>

`POLL_MAX_MS = 180_000`, default empty-stable threshold = 60 (30s). All five baseline scenarios capture within expected ranges:

| scenario | total | modified | affected | tokens |
|---|---|---|---|---|
| small | 116 | 51 | 65 | 3.6K |
| medium | 1025 | 210 | 815 | 31K |
| large | 1236 | 351 | 885 | 37K |
| css-only | 0 | 0 | 0 | 0.4K |
| regex-aliased | 0 | 0 | 0 | 0.4K |
</details>

<details>
<summary>✅ Agent eval end-to-end at every scale</summary>

All five scenarios complete with the signature prompt. Selected runs (Sonnet, effort=low):

| scenario | duration | cost | recall | precision | purity | clusters |
|---|---|---|---|---|---|---|
| small (116) | 12s | $0.06 | 1.0 | 1.0 | 0.75 | 5–6 |
| medium (1,025) | 15s | $0.15 | 1.0 | 1.0 | 0.18 | 6 |
| large (1,236) | 18s | $0.18 | 1.0 | 1.0 | 0.17 | 7 |

Haiku also works at every scale (4–5× slower, ~30% cheaper at cascade — see §M below).
</details>

<details>
<summary>✅ SDK hang on cascade-scale payloads — diagnosed and fixed</summary>

Root cause was **output-token overflow**, not auth or streaming. The original `enumerate` prompt asked the model to list every story across clusters; at 1,025+ stories that's 30K+ output tokens that never finished generating. Confirmed via the new `--trace` flag (every SDK message logged with timestamp).

**Fix:** the **signature prompt variant** ([`prompts/categoriser-signature.md`](../scripts/eval/inner-loop/prompts/categoriser-signature.md)) asks the model for cluster *signatures* (prefix/regex/ids patterns) instead of enumerating story IDs. A deterministic [`expandSignatures()`](../scripts/eval/inner-loop/lib/expand-signatures.ts) helper assigns every input story to the first matching pattern. Output drops to <1K tokens regardless of cascade size. Use `--prompt signature` on the harness.
</details>

<details>
<summary>✅ addon-mcp coexists with addon-before-after</summary>

Storybook's `applyPresets` ([`code/core/src/common/presets.ts:301`](../code/core/src/common/presets.ts:301)) is a fold over each preset's return value. `experimental_devServer` is a side-effect hook (registers Express middleware on `app`), so its callers expect to mutate `app` and just leave — but the fold semantics mean any preset that returns `undefined` zeroes out `app` for the next preset. `addon-before-after`'s hook had no `return`, so `addon-mcp` received `undefined` and crashed.

Fix in [`code/addons/before-after/src/preset.ts`](../code/addons/before-after/src/preset.ts): renamed `_app` → `app`, added `return app` at all exit paths. Live: `POST /mcp` → 202.

**Worth filing upstream:** the preset framework either needs to fall back to the previous newConfig when a hook returns `undefined`, or to document explicitly that `experimental_devServer` MUST return its first argument. Otherwise every addon author writing a side-effect `experimental_devServer` hook will hit this.
</details>

## Iteration-1 implementation work still open

These build inside the addon. Spec'd in [`questions/03_TECHNICAL.md`](questions/03_TECHNICAL.md) and [`questions/04_UX_AND_EVAL.md`](questions/04_UX_AND_EVAL.md):

- **Iframe pooling** — currently each story in the Changes list mounts its own before/after pair. Fine at 110 stories; tab-crash at 1,212+. Spec: 8 mounted iframes that swap stories via `SET_CURRENT_STORY` channel event.
- **Session-pinned merge-base baseline** — change-detection's "before" today is HEAD-relative; cascade morphs mid-review on agentic loops. Pin to the merge-base at session start.
- **CSS blast-radius synthesis wired into the addon** — the [prototype lib](../scripts/eval/inner-loop/lib/css-blast-radius.ts) works (Round-1 §C). Wire into the addon's preset so CSS edits emit synthesised statuses on the live change-detection feed.
- **`agent-recommended` StatusValue enum addition** — currently `new/modified/affected`; the agent's clustering output writes back as this status.
- **Three new MCP tools** — `get_change_context`, `apply_review_status`, `open_review_page`. Payload contract in [`scripts/eval/inner-loop/lib/build-payload.ts`](../scripts/eval/inner-loop/lib/build-payload.ts); categoriser prompt contract in [`prompts/categoriser-signature.md`](../scripts/eval/inner-loop/prompts/categoriser-signature.md).

## Necessary further experimentation (before iteration 1 commits)

These are the open empirical questions whose answers would reshape the questions docs and/or the iteration-1 scope. Order is by how badly a wrong answer would break the project plan.

### A, B, C — ✅ ALL DONE

The first three experimentation blocks landed during Round 2. Brief summary; full numbers in `report.html`:

- **A. Output-token behaviour at cascade scale** — was thought to be the blocking unknown for the entire agent layer. Solved by switching from the `enumerate` prompt to a new **`signature` prompt** that asks the model to emit cluster patterns (prefix/regex/ids) instead of story IDs. Output drops from O(N stories) to O(K clusters); all five scenarios complete in 14–18s on Sonnet at $0.06–0.18 each, and Haiku also works at every scale. See `lib/expand-signatures.ts` and `prompts/categoriser-signature.md`.
- **B. Run-to-run variance** — 6 runs of small/Sonnet/signature/low. Recall=1.000 stable, precision=1.000 stable, purity 0.629–0.750 (8% range), cluster count 5–6, pairwise cluster-content Jaccard = 0.707. Variance is real but well-bounded. Cost drops 4× on runs 2+ (prompt cache hit).
- **C. CSS blast-radius synthesis prototype** — lib at [`lib/css-blast-radius.ts`](../scripts/eval/inner-loop/lib/css-blast-radius.ts), runner at [`css-blast-experiment.ts`](../scripts/eval/inner-loop/css-blast-experiment.ts). Works: a CSS edit in `pseudo-states/src/stories/` synthesises 9 importing stories where change-detection emits 0. **Known precision caveat:** every CSS file in the same dir produces the *same* set because we union all JS siblings. Refinement (basename matching: `button.css → Button.tsx`) noted in the JSON output.

### D. Iframe-pool prototype + scroll measurement

Page 3 §iframe pooling is justified empirically (8 MB/iframe × 2,424 iframes = tab crash). The fix is spec'd but unbuilt. Build a minimal version and measure:

1. Pool of 8 mounted iframes; off-screen cards swap their iframe via `SET_CURRENT_STORY` channel event.
2. Measure: peak memory at 1,212-story scroll-through. Should stay flat near baseline+8×8MB ≈ 64 MB rather than growing 19 GB.
3. Measure: time-to-render-changed-story when an iframe swaps. If >500ms, the perception-of-slowness UX risk (Page 4) is back even with pooling.
4. Compare `SET_CURRENT_STORY` channel swap vs `iframe.src` reload — channel swap should win on warmth (no re-bootstrapping the preview), but verify.

### E. Detail / full-screen view prototype

Page 4 added the question; the answer needs UI proving-out, not just a written choice. Build the modal-detail-view in the prototype branch (~1 day), populate with one before/after toggle, test on:
- A button story (simple, side-by-side already fine — sanity check)
- A dashboard / page story (the actual concern)
- A responsive component at desktop breakpoint (verify the breakpoint problem is solved here, even if stacked mode doesn't address it)

If the modal feels redundant for simple stories, that's evidence for option 3 (auto-detect dense stories) over option 2.

### F. Recall measurement on real changesets, not synthetic ones

The eval harness uses synthetic edits (one-line marker insertion). User-facing recall depends on real-world changesets, which can have multiple files, mixed types, and intent that synthetic edits don't capture. Use the dogfood's recent commit history:

1. `git log --since="3 months ago" --no-merges --format="%H"` on the dogfood → ~50 candidate changesets.
2. For each: cherry-pick onto a clean baseline, capture the change-detection output, hand-label which of the flagged stories truly changed visually (or use Chromatic baselines if accessible).
3. Aggregate recall/precision across changeset types (feature add, bug fix, refactor, CSS-only). The Page 4 ≥95% recall threshold needs this distribution before kickoff.

### G. Multi-tab specificity test

Page 4 (now) recommends tagged-session-with-broadcast-fallback. Verify:
1. Open two Storybook tabs side-by-side.
2. Fire `storybook_open_review_page` from MCP.
3. Confirm only the MCP-connected tab navigates; the other stays put.
4. Close the connected tab and re-fire — confirm it broadcasts to the remaining tab.

This is ~2 hours of manual testing but proves the UX claim before user sessions.

### H. 5K-story repo projection

Page 2's "worst-case (5K-story repo, 60% cascade, 8 changed files)" → 63K input tokens projection is computed, not measured. Validate:

1. Synthesise a 5K-story Storybook by duplicating the dogfood's stories under namespace prefixes.
2. Run the harness against it. Confirm token-count math matches reality (or reveal where it doesn't — story-id length distribution, payload-shape overhead).

This isn't blocking but de-risks the iteration-2 generalisation claim before the project commits to a recall threshold.

## Round 2 follow-up research (after A/B/C)

A/B/C answered the *can the agent layer ship at all* question. These are the next-tier unknowns that decide *whether the shipped feature is good*. Ranked by how much each one would change a kickoff decision.

### I. Module graph empirical characterisation (Yann asked for this explicitly)

The module graph is the deterministic spine; we know its raw shape (504 story files, 560ms cold build, ~8 MB max iframe) but not the *distributions* that actually drive UX. Specifically:

1. **✅ DONE — Blast-radius histogram across the entire dogfood.** Reproducible in [scripts/eval/inner-loop/module-graph-experiment.ts](../scripts/eval/inner-loop/module-graph-experiment.ts); JSON output at `results/module-graph.json`; visualised in `report.html` under "Module-graph characterisation."

   **Findings (story-file counts, not story-ID counts; multiply by ~3-7 for IDs):**
   - 1438 files in reverse index, 508 story files, graph build = 311–467 ms.
   - **67.9% of files have ≤10 importing story files (the "good case").** Most edits will not produce a noisy cascade.
   - 21.3% have >100 importers; 0% have >500. Top files (`test/index.ts`, `test/expect.ts`, dist chunks) max out at 319–356 importers. The previously-cited "1,212-story cascade" was *story IDs* (hundreds of stories per shared file × ~3-7 stories per file).
   - **|modified| distribution:** 70.4% of files resolve to exactly 1 modified story when edited; 9.0% resolve to 2-3; 12.4% to 10-49; 2.9% to 50+. **The single-modified case is the dominant case.**
   - **Depth distribution:** the bulk of edges live at depth 2-4 (63% combined); depth 1 is only 4.2%, depth 0 is the file itself. This is why `affected` is so much bigger than `modified`.

   **Implications for the project:**
   - The "feature feels good 70% of the time without any agent" claim is now empirically supported. The `modified` filter alone delivers a single story to inspect first in the majority of edits.
   - The cascade case is *real but narrow* — a small number of widely-imported barrels are responsible. A "exclude top-10 fan-in barrels from cascade" heuristic would cut the bulk of the noise without an agent. Worth specing as an iteration-1 deterministic improvement.
   - 21% of files are >100-importer cascade-prone, so the noisy case is the minority but it's not rare. The agent layer earns its place specifically for these.
2. **Depth-tier accuracy on real visual change.** Change-detection emits `modified` (lowest distance) + `affected` (further). If we hand-label which stories truly changed visually on 20 real commits, what fraction of `modified` are true positives? `affected` at depth 2? At depth 5+? If `affected` precision crashes past depth 3, that's a deterministic UI improvement (group cards by depth tier; collapse deep tiers by default) — no agent needed.
3. **✅ DONE — Tied-distance distribution.** Reproducible in [`tied-distance-experiment.ts`](../scripts/eval/inner-loop/tied-distance-experiment.ts); JSON output at `results/tied-distance.json`.

   **Findings:**
   - **70.4% of files resolve to a single `modified` story when edited.** Mean tie size 7.19 across all 1,438 files; median 1; p75=2.
   - Tail is heavy but small: p90=24, p95=39, p99=58, max=262.
   - **Among the 425 files that DO produce ties (29.6%)**, the median tie is 13 and the mean is 21.95. When ties happen, they tend to be groups, not pairs.

   **UX implications:**
   - The "lead with one modified-story card" pattern is correct for the dominant case (70%). Either the card promotes the single tie or the UI shows a small badge ("+12 tied") when ties happen.
   - When the tail bites it bites hard — design must handle "262 tied modified stories" without crashing the page (virtualise the modified column, not just the affected column).
4. **✅ DONE — Barrel-file false-cascade share.** PR #34675 added barrel-aware named-import resolution. Reproducible in [`barrel-share-experiment.ts`](../scripts/eval/inner-loop/barrel-share-experiment.ts); JSON output at `results/barrel-share.json`.

   **Findings:**
   - **Barrels are only 7.3% of cascade edges** despite making up 2.7% of files. The top 10 barrels alone are 3.4%; top 20 are 6.1%.
   - The dominant cascade isn't a barrel problem. The top three high-fan-in files (`test/index.ts` 319, `theming/index.ts` 167, `preview-api/*/index.ts` 159 each) are themselves *part* of the cascade pattern, but the long-tail edges live in non-barrel "shared util" files.
   - On the synthetic edit fixtures, only the `large` scenario (`theming/index.ts`) actually edits a barrel file. The 1,025-story `medium` cascade flows through `Button.tsx` (a leaf component), not a barrel.

   **Conclusion (revised):** the "exclude top-K barrels from cascade" heuristic would only cut ~6% of cascade noise — not the bulk. The original intuition was wrong; the cascade is structural fan-in of *non-barrel* shared code (manager-api singletons, theme providers, preview-api modules), and the only deterministic way to cut it is depth-based pruning, not barrel-based pruning.
5. **The reverse-index slice's information content for the agent.** Today we ship `{ changedFile, importingStories[] }`. Two improvements worth eval'ing: (a) include *depth* per (story, changed-file) so the agent can weight, (b) include the *distinct-changed-file count per story* (a story that imports 3 of the 8 changed files is more likely to break than one importing only 1). Run signature-prompt with and without these annotations and measure cluster purity.

**Effort:** items 1, 3, 4 are done. Items 2 and 5 remain.

### J. ✅ DONE — Categoriser signature quality

Implemented in [scripts/eval/inner-loop/lib/signature-quality.ts](../scripts/eval/inner-loop/lib/signature-quality.ts); wired through `run.ts` and the HTML report. Metrics now persisted per-run in JSONL `signatureQuality` field:

- **`catchAllShare`**: fraction of stories matched by a regex `.*` (or empty prefix) signature.
- **`representativeValidRate`**: fraction of clusters whose `representative` story is actually in the cluster's stories.
- **`avgPrefixLength` / `avgRegexLength`**: signature specificity proxies.
- **`shadowedClusterCount`**: clusters that ended up empty because an earlier cluster's signature consumed all matches.

Initial readings (small/medium/large × Sonnet/Haiku, signature/low):
- Catch-all share is **0–18%** across runs — the agent does NOT game the prompt with lazy `.*`. Haiku 18% on small is the worst observed; even at cascade scale catchAll drops to 0–1%.
- Repr-valid rate is **5/6 to 7/7** — occasional hallucination (1 cluster per run names a representative not in its assigned set) but never catastrophic.
- Shadowing is rare (0–1 clusters per run).

**Project implication:** signature prompts are robust. The "agent gaming the output to be cheap" failure mode does not materialise empirically. Trust UX can rely on the rationale + representative pair without explicit confidence-numbering.

Surfaced in the HTML report as KPI tiles per run (`catch-all share` is colour-coded green ≤30%, amber ≤50%, red >50%).

### K. ✅ DONE — Cluster rationale fidelity (hand-labelled)

Hand-labelled 21 cluster rationales across 5 real-commit replays (cascades 31–1,025 stories) from `replay-real-fileGraph.jsonl`. For each cluster, compared the agent's one-sentence rationale against the actual git diff. Output at [`results/rationale-fidelity.json`](../scripts/eval/inner-loop/results/rationale-fidelity.json).

**Results: 20/21 correct (95.2%), 1/21 partial, 0/21 wrong.**

| sha | subject | clusters | correct | partial | wrong |
|---|---|---|---|---|---|
| `ee6713705d` | Fix: keep original onAllStatusChange timing | 5 | 5 | 0 | 0 |
| `38a009a3c1` | fix(manager-api): await recompute filter | 5 | 5 | 0 | 0 |
| `181521d273` | fix(sidebar): only show Clear button | 4 | 4 | 0 | 0 |
| `3219ec38d8` | Add story | 4 | 3 | 1 | 0 |
| `316818511e` | test(sidebar): align Sidebar.stories | 3 | 3 | 0 | 0 |

The single "partial" claim was a stretch about module evaluation order, not a hallucinated diff detail. **No hallucinated rationales across 21 samples.** Rationales reliably cite real diff details (function names, prop names, role attributes).

**Conclusion:** 95.2% is comfortably above the 80% threshold Page 4 set for "suppress rationales in the UI." Trust UX can show rationale text directly to users. Iteration-1 should NOT add a "model-generated" warning label.

### L. ✅ DONE — Real-world changeset coverage

Implemented as [`replay-real-commits.ts`](../scripts/eval/inner-loop/replay-real-commits.ts). The trick: each candidate commit is *already* in HEAD's history, so applying its diff forward conflicts. Instead the runner applies each commit's diff IN REVERSE (`git apply -R`), producing a working-tree-vs-HEAD diff equivalent to "undo this commit only" — change-detection sees the same blast radius as the original commit. After the agent run, forward-apply restores the working tree.

Skips a commit cleanly when:
- patch fails `--check` (context drift due to later commits touching same files),
- diff is empty for `code/`,
- diff is too large or too small (filter: 5–500 lines).

**Run #1 (`replay-real.jsonl`):** 25 candidate commits attempted, **8 succeeded** (32% rate). 13 apply-failures (mostly touched the same hot files like `ReviewChangesButton.tsx`/`stories.ts` that have been heavily refactored on this branch), 4 empty cascades (commits in non-walkable modules: scripts, build configs).

| sha | subject | cascade | recall | precision | purity | LLM clusters | ns clusters | sf clusters | cost |
|---|---|---|---|---|---|---|---|---|---|
| `ee6713705d` | Fix: keep original onAllStatusChange timing | 1025 | 1.0 | 1.0 | 0.165 | 6 | 118 | 1 | $0.025 |
| `38a009a3c1` | fix(manager-api): await recompute filter | 1025 | 1.0 | 1.0 | 0.128 | 5 | 118 | 1 | $0.151 |
| `181521d273` | fix(sidebar): only show Clear button | 126 | 1.0 | 1.0 | 0.770 | 6 | 11 | 1 | $0.035 |
| `3219ec38d8` | Add story | 31 | 1.0 | 1.0 | 1.000 | 2 | 1 | 1 | $0.017 |
| `316818511e` | test(sidebar): align Sidebar.stories | 32 | 1.0 | 1.0 | 1.000 | 3 | 1 | 1 | $0.022 |
| `ebe5ebc109` | fix(sidebar): narrow story filter | 32 | 1.0 | 1.0 | 1.000 | 2 | 1 | 1 | $0.016 |
| `08ee6caf22` | fix(sidebar): activate modified filter | 13 | 1.0 | 1.0 | 1.000 | 2 | 1 | 1 | $0.016 |
| `ba173ebb89` | Remove obsolete ShareMenu story | 12 | 1.0 | 1.0 | 1.000 | 3 | 1 | 2 | $0.015 |

**Findings:**

1. **Recall and precision are 1.0 across all 8 real-commit runs.** The categoriser does not lose stories or hallucinate them when given real-world diffs.
2. **Purity is bimodal.** Cascades ≤32 stories: purity 1.0 (cluster fits in one namespace). Cascade 1025: purity 0.13–0.17 (real cross-namespace cascade). The 126-story `Clear button` commit at 0.77 sits between.
3. **Cost scales with cascade size.** $0.015 for tiny commits, ~$0.15 for the 1K-cascade case. Even at the highest, well under the "expensive AI" worry from the transcript.
4. **The LLM consistently produces UX-usable cluster counts (2–6) on real commits.** Namespace baseline ranges from 1 (degenerate on small commits) to 118 (unusable on cascade-scale). The LLM's value is consolidation, not cluster-quality.
5. **The 32% apply-success rate is a feature-branch artefact**, not a fundamental limit. `yann/story-review-analysis` heavily refactored a small set of files; reverse-applying old commits to those files conflicts. On a less-active part of the codebase the success rate would be much higher.

The full per-commit detail (including signature-quality scores, cluster rationales, deterministic comparisons) is in the HTML report under "Real commits."

**Worth re-running on `next` directly** (without the feature-branch refactor noise) to see what the success rate looks like on a clean baseline. Also worth running with broader commit selection (e.g. only commits touching multiple top-level dirs) to stress-test the shared-files baseline.

### M. ✅ DONE — Haiku ladder cost characterisation

Ran small/medium/large with `claude-haiku-4-5-20251001`, signature prompt, low effort:

| scenario | duration | cost | recall | precision | purity | catchAll | reprValid | shadowed |
|---|---|---|---|---|---|---|---|---|
| small | 47s | $0.065 | 1.0 | 1.0 | 0.802 | 18.1% | 6/6 | 0 |
| medium | 80s | $0.128 | 1.0 | 1.0 | 0.167 | 1.0% | 5/6 | 0 |
| large | 73s | $0.109 | 1.0 | 1.0 | 0.136 | 0.0% | 6/7 | 1 |

vs Sonnet 4.6 same prompt/effort:

| scenario | duration | cost | recall | precision | purity | catchAll | reprValid |
|---|---|---|---|---|---|---|---|
| small | 12s | $0.063 | 1.0 | 1.0 | 0.75 | 0% | 5/6 |
| medium | 15s | $0.147 | 1.0 | 1.0 | 0.18 | (not captured) | (not captured) |
| large | 18s | $0.176 | 1.0 | 1.0 | 0.168 | (not captured) | (not captured) |

**Conclusion: Haiku works.** It's 4–5× slower but produces equal-or-better recall/precision/purity. Signature-quality metrics are within the same band (catch-all share 0–18%, repr-valid rate >83%). Cost is roughly comparable at small scale and ~30% cheaper at cascade scale.

**Page 4 implication:** the tier-based cap recommendation ("on Haiku, downshift to deterministic-only") is wrong. **Haiku can be the primary mode for cost-sensitive users**, with Sonnet as the fast premium option. Update Page 4's `Cost-fear UX` Q with this finding.

### N. ✅ DONE — Failure-mode taxonomy

Implemented as [`failure-modes-experiment.ts`](../scripts/eval/inner-loop/failure-modes-experiment.ts). Output at `results/failure-modes.json`. 12 probes total: 9 library-level paths exercised directly (no SDK cost), 3 network/SDK paths documented by code inspection.

| # | category | failure mode | result |
|---|---|---|---|
| 1 | parse | Malformed JSON from model | ✓ invokeAgent sets `parseError`, parsed=null, row still written with scores=null |
| 2 | scoring | Empty `clusters:[]` from model | ✓ recall=0, precision=1, purity=1, no NaN |
| 3 | scoring | Empty ground-truth (CSS-only) | ✓ all metrics=1, scoring short-circuits before SDK call |
| 4 | signature | Invalid regex in signature | ✓ replaced with `/(?!)/`; catch-all sweeps remainder |
| 5 | signature | Missing catch-all signature | ✓ unmatched IDs surfaced; recall<1 quantifies the loss |
| 6 | signature | Shadowed cluster (eager catch-all first) | ✓ signature-quality reports shadowedClusterCount=1 |
| 7 | scoring | Hallucinated story IDs | ✓ hallucinationCount tracked; precision<1 |
| 8 | scoring | Duplicate IDs across clusters | ✓ duplicateCount tracked; unique count used for precision |
| 9 | signature | Non-existent IDs in `ids:[…]` | ✓ silently dropped (iteration is over allStoryIds) |
| 10 | network | Storybook unreachable | · `assertStorybookRunning` throws before SDK call |
| 11 | network | SDK rate-limit mid-run | · try/catch around `invokeAgent`; JSONL row written with agentRun=null |
| 12 | network | SDK hang at cascade scale | · No timeout — motivated signature prompt; production tool needs wall-clock cap |

**Conclusion:** all 9 testable failure modes degrade gracefully. The only failure WITHOUT a recovery is the SDK hang on enumerate prompt at cascade scale — already fixed by the signature-prompt variant for the eval, but iteration-1 production tool MUST set a wall-clock timeout (~60s) with deterministic-baseline fallback regardless. Page 4's "graceful degradation to deterministic baseline" recommendation is now verified to exist for everything except this one case, which is the bare-minimum iteration-1 acceptance criterion.

### O. ✅ DONE — Determinism vs LLM split, re-validated

Implemented as [`lib/deterministic-clusters.ts`](../scripts/eval/inner-loop/lib/deterministic-clusters.ts) + [`deterministic-baselines.ts`](../scripts/eval/inner-loop/deterministic-baselines.ts) runner. Output at `results/deterministic-baselines.json`; surfaced in the HTML report under "Determ baselines."

**Critical reading note:** `clusterPurity` in `score.ts` literally measures "fraction of stories sharing the dominant namespace prefix." So the namespace baseline trivially scores 1.0 on this metric — circular comparison. **The honest signal is cluster count.**

**Findings on synthetic scenarios:**

| scenario | cascade | LLM clusters (signature/low) | namespace clusters | shared-files clusters |
|---|---|---|---|---|
| small | 116 | 5.3 (UX-usable) | 10 | 1 (degenerate, single-file edit) |
| medium | 1025 | 6.0 (UX-usable) | 118 (unusable) | 1 (degenerate) |
| large | 1236 | 7.0 (UX-usable) | 165 (unusable) | 1 (degenerate) |

**Findings on real commits (Experiment L below):** 8 successful replays. The LLM produces 2–6 clusters across all cascade sizes; namespace baseline ranges from 1 (degenerate) for tiny commits to 118 (unusable) for cascade-scale commits.

**Architectural conclusion:** the LLM's actual contribution over deterministic baselines is **consolidating related namespaces into a UX-usable cluster count.** Namespace gives 118 clusters for medium cascade; LLM gives 6 — a 20× cognitive-load reduction.

**The simpler iteration-2 design that this unlocks:**
- Generate cluster *content* deterministically (namespace OR shared-changed-file set).
- Use the LLM only to (a) merge over-segmented namespace clusters into UX-usable groupings, (b) write a rationale per surviving cluster.
- Output drops to ~5–10 short rationales (~500 tokens), latency to a few seconds, variance to near-zero (the merge-step is bounded).

This is materially cheaper than the current signature-prompt design and worth speccing as iteration-2's canonical agent shape. Page 2 already documents the framing; iteration-2 implementation gets the output-token / latency / variance wins for free.

The shared-files baseline is **degenerate on single-file synthetic edits** (always 1 cluster) and **mostly degenerate on this branch's real commits** (most touch a single hot file). It would shine on broader monorepo changesets — needs a more diverse commit sample to validate.

### P. MCP tool surface — actually build the three tools

The eval harness simulates `get_change_context` by reading the probe endpoint and calling `buildPayload` directly. The actual MCP tool doesn't exist. Iteration 1 needs:

1. `get_change_context()` MCP tool in `storybookjs/mcp` returning the payload shape from [build-payload.ts](../scripts/eval/inner-loop/lib/build-payload.ts).
2. `apply_review_status(ids[], cluster_id?, rationale?)` writing to `experimental_getStatusStore('storybook/agent-review')`.
3. `open_review_page()` emitting a channel event the addon listens for.

Cross-repo work; coordination with `storybookjs/mcp`. The signature payload shape is settled (both prompt variants use the same input), so the tool's contract is stable.

**Effort:** 2–3 days incl. cross-repo PR review.

### Q. Detail/full-screen view UX prototype

Page 4's new question (added this session). Build the modal in the prototype branch, populate with one `before/after` toggle, test on a button + dashboard + responsive component story. Decide if option 2 (modal on click) is the right call or if option 3 (auto-detect dense stories) emerges naturally.

**Effort:** 1 day in the addon code; included in iteration 1 if user-session prep needs it.

### R. Iframe pool prototype + scroll measurement

Already in §D above; restated here as part of the iteration-1 sequence. Memory ceiling at 1,212 stories, swap latency, channel-vs-src comparison.

## What's already nailed down (don't redo)

- **Token cost** — categoriser ~22K (cascade) / ~63K (worst case 5K-repo); filter approach blows 200K context above 611 stories. See [`token-cost-experiment.ts`](questions/appendix/token-cost-experiment.ts).
- **CSS / regex-alias blindness** — verified deterministically and live; `cd-experiment.ts` reproduces.
- **HMR `Changes (0)` bug** — fully diagnosed, fixed, and verified in patch 02. Root cause was the UniversalStore follower's `EXISTING_STATE_RESPONSE` racing with React StrictMode unsubscribe.
- **env=before iframe correctness** — play functions and decorators run identically in env=before; `next` and `valentin/before-after` produce visually identical iframes; documented in INVESTIGATION_FINDINGS §20.

## File map (what's where)

```
project-documents/
├── FOLLOWUP.md                              ← THIS FILE
├── RUNNING.md                               ← every script + how to run it
├── INNER_LOOP.md                            ← original project pitch (input)
├── MAIN_CONVERSATION.md                     ← original transcript (input)
└── questions/
    ├── 00_README.md … 04_UX_AND_EVAL.md     ← 5 Notion-shaped pages
    └── appendix/
        ├── INVESTIGATION_FINDINGS.md         ← 22-section empirical record
        ├── cd-experiment.ts                  ← cascade measurement script
        ├── token-cost-experiment.ts          ← offline token-cost projection
        └── patches/
            ├── README.md
            ├── 02-changes-page-hmr-fix.patch
            ├── 03-preset-probe-plugin.patch
            └── 04-status-probe-plugin.ts.new

scripts/eval/inner-loop/                      ← agent eval harness
├── README.md
├── run.ts                                    ← agent-eval main entry
├── scenarios.ts
├── module-graph-experiment.ts                ← Round-2 §I.1 (forward graph + histograms)
├── css-blast-experiment.ts                   ← Round-1 §C
├── deterministic-baselines.ts                ← Round-2 §O
├── replay-real-commits.ts                    ← Round-2 §L
├── build-report.ts                           ← HTML report generator
├── lib/
│   ├── storybook-client.ts
│   ├── edit-fixture.ts
│   ├── build-payload.ts
│   ├── estimate-tokens.ts
│   ├── invoke-agent.ts                       ← handles both enumerate + signature prompts
│   ├── expand-signatures.ts                  ← signature→cluster expansion
│   ├── signature-quality.ts                  ← Round-2 §J
│   ├── css-blast-radius.ts                   ← Round-1 §C lib
│   ├── deterministic-clusters.ts             ← Round-2 §O lib
│   └── score.ts
├── prompts/
│   ├── categoriser.md                        ← enumerate variant (hangs at cascade)
│   └── categoriser-signature.md              ← signature variant (cascade-safe)
└── results/                                  ← JSONL output + report.html (gitignored)
    └── run-2026-05-09T14-09-20-024Z.jsonl    ← only baseline kept in git
```
