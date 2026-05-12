# Deterministic vs AI

This is the spine of the project. Most of what people imagine the agent doing is actually a deterministic lookup over the existing module graph and git diff. The agent's real value is not "filter K stories from N" — that's a noisy, expensive way to do something the change-detection algorithm already does. The agent's real value is **explanation and grouping** of an already-bounded set.

Get this split wrong and the project either over-builds the agent (slow, expensive, user-mistrusted) or under-uses it (just another sidebar filter).

---

## Empirical token cost (resolves the "expensive AI" worry)

The categoriser framing has been measured. The agent's input is a structured payload (modified[] + affected[] + diff hunks + project shape + reverse-index slice). It is **not** the source code of the candidate stories.

| Scenario | Stories flagged | Estimated tokens | % of 200K context | ~Cost on Sonnet 4.6 |
|---|---|---|---|---|
| Typical edit (Sidebar.tsx) | 110 | 2,736 | 1.4% | ~$0.08 |
| Cascade edit (theming/index.ts) | 1,212 | 22,148 | 11% | ~$0.21 |
| Worst-case (5K-story repo, 60% cascade) | 3,250 | 63,499 | 32% | ~$0.49 |
| **Filter approach** (sends story sources) | 1,212 | **396,324** | **exceeds context** | n/a |

The filter approach exceeds Sonnet's 200K context at **611 stories** — mathematically untenable for any non-trivial repo. The categoriser approach scales to ~10,000-story repos before hitting limits.

On Haiku 4.5 (~5× cheaper input, ~12× cheaper output): all scenarios under $0.10 per invocation.

**Conclusion: the "expensive AI" worry from the transcript does not materialise** if we use the categoriser architecture. The reproducible measurement script is at [`appendix/token-cost-experiment.ts`](appendix/token-cost-experiment.ts).

### Round 2 (May 10) — output-token cost is the actual blocker, and it's solved

The input-token analysis above is correct but incomplete. **At the cascade scale, output tokens are the binding constraint, not input.**

The original `categoriser.md` prompt asks the agent to enumerate every story across clusters: with 1,212 affected stories, the output is ~30–40K tokens of story IDs. Empirically observed on Sonnet 4.6 low-effort: **the SDK call never returns** — TCP stays open, the `claude` subprocess stays alive at 0% CPU, no streaming events arrive past the initial `assistant [thinking]` block. Reproduced reliably on `medium` (1,025 stories) and `large` (1,236 stories).

The fix is a different prompt design, not a different model. The new [`categoriser-signature.md`](../../scripts/eval/inner-loop/prompts/categoriser-signature.md) asks the agent for cluster *signatures* — `prefix`, `regex`, or `ids` patterns — and a deterministic [`expandSignatures()`](../../scripts/eval/inner-loop/lib/expand-signatures.ts) helper assigns every input story to the first matching signature. Output drops from O(N stories) to O(K clusters) ≈ 5–10 patterns.

| Scenario | Signature output tokens | Duration (Sonnet/low) | Cost (Sonnet/low) |
|---|---|---|---|
| `small` (116 stories) | 629 | 14s | $0.06 |
| `medium` (1,025) | 669 | 15s | $0.15 |
| `large` (1,236) | 962 | 18s | $0.18 |

**Recall, precision, purity:** all at 1.0/1.0/0.17–0.75 across the three scales (purity scales down with cascade size because namespace-prefix purity is harder when the cascade legitimately spans namespaces).

**Variance** (6 runs of `small` × Sonnet/signature/low): recall=1.000 stable, precision=1.000 stable, purity 0.629–0.750 (8% drift), pairwise cluster-content Jaccard = 0.707. Cost drops 4× on runs 2+ thanks to prompt cache (input ~22K tokens cached as a single block).

**Architectural implication:** any future categoriser-style agent design must produce O(K) output, never O(N). The signature-prompt is the canonical iteration-2 design. Re-validation in [FOLLOWUP §A](../../FOLLOWUP.md) and the eval harness; reproducible via `node ... scripts/eval/inner-loop/run.ts --prompt signature ...`.

**Implication for the deterministic vs AI split:** with output bounded to O(K), simple deterministic baselines (group stories by which subset of changed files they import; group by namespace prefix) become directly comparable to LLM clusters because they emit the same shape. If those baselines are within 10% of the LLM's purity, **the agent's job collapses from "cluster + rationalise" to "rationalise an already-clustered set"** — a much smaller, much cheaper task. See [FOLLOWUP §O](../../FOLLOWUP.md) — pending experiment.

## TL;DR

| Layer | Built with | Iteration |
|---|---|---|
| **Discovery: what stories were touched** | Deterministic — module graph + git diff | Already shipped |
| **Augmentation: what was *also* touched but isn't in the graph (CSS, types)** | Deterministic — raw diff + reverse-index lookup | Iteration 1 |
| **Selection: which stories matter most** | Deterministic — depth-based prioritisation (`modified` first) | Already shipped |
| **Rendering: side-by-side diff** | Deterministic — Vite Environment API serves HEAD content | Already shipped (PR #34569) |
| **Categorization: group N stories by likely shared root cause** | AI | Iteration 2 |
| **Explanation: per-cluster human-readable rationale** | AI | Iteration 2 |
| **Quality judgement: did this CSS edit visibly change this story?** | AI (best-effort) or VRT (deterministic but heavy) | Out of scope for 10.5 |

The AI does a much smaller, weaker reasoning task in this split than the pitch implies. That's a feature, not a bug.

---

## What the deterministic system can already do

Every item below is shipped in `next` or in the prototype branch. None of it requires an agent.

### 1. Compute the affected set from a git diff
[`ChangeDetectionService`](../../code/core/src/core-server/change-detection/ChangeDetectionService.ts) walks Storybook's import graph (built via [`DependencyGraphBuilder`](../../code/core/src/core-server/change-detection/dependency-graph/DependencyGraphBuilder.ts)) from each story file, records depth per (dep, story) edge in a reverse index, and on each git change emits `modified` (lowest-distance importing stories) / `affected` (further) / `new` statuses.

**Empirical performance**: 504 story files → graph built in ~560ms cold. Subsequent scans debounced 200ms.

**Empirical accuracy** (live, in dogfood):
- 1-line edit to `Sidebar.tsx` (typical first-party file) → **110 stories flagged** (44 modified + 66 affected).
- 1-line edit to `theming/index.ts` (shared utility, string-aliased) → **1,212 stories flagged** (75% of all).
- Edit to `core/src/test/expect.ts` (regex-aliased barrel) → **0 stories** (opaque-leaf — see caveats).

### 2. Surface those statuses in the UI
[`status-store`](../../code/core/src/shared/status-store/index.ts) replicates statuses across server/manager/preview via UniversalStore. URL filtering (`?statuses=modified;new;!error`) ships in [`statuses.ts`](../../code/core/src/manager-api/modules/statuses.ts). Sidebar icons + counts ship in `ReviewChangesButton.tsx` (on `next`, not on the PR branch — they were added later).

### 3. Render before/after side-by-side
The prototype's [`before-environment-plugin.ts`](https://github.com/storybookjs/storybook/blob/valentin/before-after/code/addons/before-after/src/node/before-environment-plugin.ts) registers a `storybookBefore` Vite environment. Requests with `?env=before` route through it; the plugin rewrites HTML/JS/dynamic imports to propagate the marker. Verified live: fetching `Sidebar.tsx?env=before` returns HEAD content, fetching without returns working-tree. **Works correctly for both JS and CSS** (verified by editing `bundle-analyzer/index.css` and observing distinct content).

### 4. Drive the page from outside Storybook
[`@storybook/addon-mcp`](https://github.com/storybookjs/mcp) already establishes the channel-based agent ↔ Storybook pattern via tools like `run-story-tests` (which actually runs Vitest). Adding a tool that emits a navigation event to open the Changes page is a half-day of work using the existing `triggerTestRun` request/response primitive.

---

## What deterministic CAN do but isn't wired up yet

These are short additions (days, not weeks), purely deterministic, and would noticeably improve the input the agent operates on. They belong in iteration 1.

### 1. CSS (and other non-walked extensions) blast-radius via reverse-index lookup
**Problem**: change-detection is structurally CSS-blind ([`DependencyGraphBuilder.test.ts`](../../code/core/src/core-server/change-detection/dependency-graph/DependencyGraphBuilder.test.ts) test: *"skips CSS imports (they are not walkable)"*). Edit `button.css`, get 0 statuses. Confirmed live.

**Deterministic fix**: when computing the change set, also enumerate `.css/.scss/.sass/.less` (and other non-walked extensions) in the git diff. For each, walk the existing module graph and find any story file whose import-graph contains a JS/TS file that lives in the same directory (or is imported via a CSS-import side-effect). Those stories get a synthesised `affected` status with metadata explaining the CSS-derived origin.

This is **purely a reverse-index query** — no AI needed. The accuracy is bounded by "did anyone import any module from this directory" which is high-recall for a design-system check.

### 2. Raw git diff in the agent's input

> **Revised after reviewing [storybookjs/mcp PR #219](https://github.com/storybookjs/mcp/pull/219).** Earlier drafts of this section proposed a new `get_change_context` MCP tool that bundled "list of changed stories + raw diff + project shape + reverse-index slice" into one call. The merged PR ships only the *list-of-changed-stories* half (as `get-changed-stories`, returning markdown text not structured JSON). The raw diff is **agent-side** — the agent already has filesystem/git tools and assembles its own diff context.

Updated split:

| What the agent needs | Source |
|---|---|
| `modified[]` / `affected[]` (= `related`) / `new[]` story IDs with `title` + `name` + `importPath` | `get-changed-stories` MCP tool (shipped) |
| Raw `git diff` hunks per changed file | Agent's own filesystem/git tools |
| Project-shape summary (story count, top namespaces) for self-tuning | Either: inline into `get-changed-stories` output, or skip (agent rarely needs this on iteration 1) |
| Reverse-index slice (`changedFile → importing stories`) | Either: extend `get-changed-stories` with an optional flag, or roll into change-detection's status data |

Iteration-1 contract is simpler than the original draft and reuses what's already published.

### 3. Session-pinned baseline (merge-base)
Currently the prototype's "before" is git HEAD. In an agentic loop the agent commits/amends; HEAD shifts and "before" moves with it. The user's mental model is "before this whole feature."

**Deterministic fix**: replace `.git/HEAD` watcher with a stored SHA captured at session start (default: merge-base of the current branch with `next`/`main`; fallback to HEAD on `main`). One configuration option, zero algorithmic change.

### 4. Iframe pooling at scale
**Empirical wall**: ~8 MB per iframe. 75%-cascade scenario (1,212 stories) in compare mode = 2,424 iframes ≈ 19 GB browser memory if user scrolls through. Currently lazy-mount works on initial open but **never unmounts** ([`LazyStoryList.tsx`](https://github.com/storybookjs/storybook/blob/valentin/before-after/code/addons/before-after/src/components/LazyStoryList.tsx) comment: *"Keep-alive: never unmount once mounted"*).

**Deterministic fix**: a fixed iframe pool (e.g. 8 visible + 4 reserved). Off-screen cards swap their iframe via `SET_CURRENT_STORY` channel event ([`core-events/index.ts:17`](../../code/core/src/core-events/index.ts)). The pattern is already in core; it's just not used by the addon.

### 5. Status taxonomy: `agent-recommended`
Adding a new value to the [`StatusValue`](../../code/core/src/shared/status-store/index.ts) enum is a 1-day patch. URL filtering automatically composes (`?statuses=modified;new;agent-recommended`). The MCP tool `apply_review_status(story_ids[])` calls `experimental_getStatusStore('storybook/agent-review').set([...])`.

The same plumbing also supports cluster IDs — store cluster-id in `status.data: { clusterId: 'button-css', clusterRationale: '...' }`. UI groups by `clusterId`; rationale is human text. **Verified end-to-end**: writing 5 statuses with cluster_id + rationale via `experimental_getStatusStore('storybook/agent-review').set([...])` and reading them back via `getAll()` returns intact data. No infrastructure change needed beyond adding the new enum value.

---

## What deterministic CANNOT do

The real limitations. These are why the agent layer eventually exists.

### 1. Categorise stories by likely shared root cause
"These 30 affected stories all share a Button click handler that was changed; these 50 are all using the same modal layout that shifted." The reverse-index can compute the *file* root cause for each story, but it can't tell whether file-changes A and B are semantically the same kind of change vs. unrelated changes that happen to affect the same story.

A deterministic clustering by "set of changed files in each story's transitive deps" works as a baseline (group stories by which of the changed files they import). It's coarse but reasonable. The agent improves on this by recognising that "Button.tsx changed because we updated the disabled-state style" is one cluster, distinct from "Button.tsx changed because the click handler was refactored," even though both edits show up in the same file.

This kind of intent classification is genuinely a reasoning task the agent does better than any algorithm. Whether it's *worth the cost* is a separate question — answered by user sessions.

### 2. Generate human-readable rationales
"This story is flagged because Button's hover state changed and your story uses Button with `variant=primary`." A deterministic system can produce *"this story imports Button.tsx, which was modified"* — which is correct but lifeless. The agent transforms graph facts into explanations.

The catch: agents will sometimes fabricate plausible-sounding but wrong rationales. Mitigation: rationales should cite the underlying graph facts ("imports Button.tsx") so users can verify.

### 3. Decide whether a CSS edit is *visually* significant
The CSS-blast-radius lookup (deterministic fix above) tells you which stories *might* be visually affected. It can't tell you whether the change actually moved a pixel — that requires either visual diff (VRT, out of scope), a DOM-level dry-run, or agent reasoning about the rendered output.

For iteration 1, "might be affected" is enough. The user looks at the side-by-side diff and decides. The agent's potential job in iteration 2 is to read the rendered DOM and judge "this CSS edit doesn't affect any element this story actually mounts" — but this is a deep rabbit hole.

### 4. Reach 100% recall on a noisy input
The deterministic input to the agent has known blind spots:
- CSS files (mitigated by the reverse-index lookup above, still imperfect)
- Type-only imports (the parser skips them)
- Regex-aliased barrels (resolver can't follow them)
- `.d.ts` auto-included files
- node_modules

No amount of agent cleverness fills these holes. The agent's recall is bounded by what change-detection + augmentations surface to it.

---

## What AI can NOT do reliably

These are the limits the team should be honest about.

- **Replace change-detection.** The module graph is the foundation. An LLM cannot rebuild it from source per call (token-prohibitive on 1,000+ files) and won't reproduce 100% of import edges anyway.
- **Be deterministic across runs.** Two invocations on the same input may differ. *Round 2 §B measured:* recall/precision perfectly stable across 6 runs; purity drifts 8% (0.629–0.750); pairwise cluster-content Jaccard 0.707. Variance is real but well-bounded.
- ~~**Be cheap on large repos.**~~ **Walked back in Round 2.** Signature-prompt + Sonnet completes 1,236-story cascade in 18s at $0.18. Haiku does it in 73s at $0.11. Both well under the "one call per session" cost ceiling the original framing feared.
- **Detect false negatives in its own output.** If the agent silently drops a real-change story from a cluster, no internal check catches it. *Round-2 mitigation:* the signature prompt forces every input story to a cluster via deterministic expansion (no drops possible by construction). Recall=1 across every signature-mode run measured.
- **Be trusted on first encounter.** Users learn whether the agent is reliable by using it; until then, every shortlist must be paired with the safety net (zoom out to broader changeset).

---

## The split for this project

Iteration 1 (weeks 1-2) — **fully deterministic**:

| What | Where built | Approx cost |
|---|---|---|
| Polish PR #34569 (fix build-config bug, iframe pooling, session-pinned baseline) | `code/addons/before-after` | 3-5 days |
| ✅ ~~MCP tool `get_change_context`~~ — already shipped as `get-changed-stories` in [PR #219](https://github.com/storybookjs/mcp/pull/219) | `storybookjs/mcp` | — |
| ✅ ~~MCP tool `apply_review_status`~~ — not needed in iteration 1; addon owns its status store | — | — |
| New MCP tool `open-review-page(storyIds | reviewSlug)` (channel event → tab navigates to `/review/<uid>`) | `storybookjs/mcp` | ~1 day |
| `agent-recommended` status value + cluster-data carrier | `code/core/src/shared/status-store` | 1 day |
| Wire `addon-mcp` into dogfood (with `changeDetectionEnabled: true`) | `code/package.json` + `code/.storybook/main.ts` | 0.5 days |
| Telemetry on review-page open / close / scroll-depth | `code/addons/before-after/src/preset.ts` | 0.5 days |

**Total: ~6-8 engineer-days** (revised down — the bulk of the MCP work is already merged). Two engineers can do this comfortably in a week.

User sessions in weeks 3-4 evaluate whether this deterministic flow is *enough*.

Iteration 2 (weeks 5-6) — **AI layer added if user sessions ask for it**:

| What | Why agent | Approx cost |
|---|---|---|
| Cluster stories (signature prompt or namespace-deterministic + LLM merge) | Reasoning task | 2-3 days (prompt + tool + eval) |
| Generate per-cluster rationale text | Reasoning task | 1 day |
| ~~Tier-based behaviour (small repo = full clusters; large repo = top-N + skip)~~ | ~~Not needed — Round 2 §M shows Haiku works at every cascade scale (47-80s, $0.06-0.13)~~ | — |

> **Round-2 update on this table:** Original iteration-2 estimate was 3–4 days to build the categoriser because "cluster all N stories" was assumed to need an LLM. Round-2 §O measured that namespace-prefix clustering produces UX-usable cluster *content* deterministically — the LLM's actual value is *consolidating over-segmented namespace buckets* and *writing rationales*. That's a much smaller agent task: ~500 output tokens, a few seconds of latency. **Estimate drops to 2–3 days** (prompt + the deterministic namespace clusterer + a thin LLM "merge clusters that share a root cause + write rationales" step). The tier-based fallback row is removed because Haiku already handles the cost edge case.

**If user sessions say the deterministic flow is enough, iteration 2 is iframe-pool optimisation, persistence, and other UX polish.**

---

## Concrete tool surface for iteration 1

Two tools shipped, one to add.

**Already shipped in `@storybook/addon-mcp` (PR #219, `dev` toolset):**

```ts
// Returns markdown-formatted text grouped by status; NOT structured JSON.
// Sourced from experimental_getStatusStore('storybook/change-detection').
get-changed-stories(): TextContent  // {storyId, title, name, importPath} per story

// Returns iframe URLs for a set of story IDs.
preview-stories(storyIds: StoryID[]): TextContent
```

**New, to add (~1 day cross-repo PR):**

```ts
// Channel event → addon listens → tab navigates to /review/<uid>
open-review-page(input: { storyIds?: StoryID[]; reviewSlug?: string }): void
```

The agent's per-iteration workflow:

1. Author/edit a component.
2. Call `get-changed-stories` → see what change-detection flagged.
3. Assemble raw `git diff` via filesystem tools (agent-side; not MCP's job).
4. Optionally categorise: produce cluster signatures via the agent's own reasoning pass (the signature-prompt design from Round-2; runs on the agent's transport, not MCP).
5. Call `open-review-page` → user is taken to the review page with either the raw story list or the agent's cluster signatures.

This is significantly simpler than the original draft, which assumed `get_change_context` would be a new structured-JSON MCP tool. PR #219 already settled the question with a markdown-text discovery surface, and our cluster-signature design is agent-side reasoning over what that tool returns plus the agent's own context.

**The architectural unlock is still real:** the tools don't care whether their caller is an agent or a deterministic script. iteration 1 can ship without an agent — a CLI wrapper that calls `get-changed-stories`, applies the modified/affected sets as-is, opens the page is a valid v1.

---

## Decisions on this page

These are the questions the deterministic-vs-AI split forces:

### **Do we accept "deterministic-only" as a possible end state for the project?**

If user sessions in weeks 3-4 say the deterministic flow is sufficient, we ship that and don't add the agent layer. This is genuinely possible (the team's [PR #34701](https://github.com/storybookjs/storybook/pull/34701) decision to hide the affected-icon by default suggests sidebar UX matters more than agent quality for noise-reduction).

1. **Yes** — deterministic ship is success, agent is optional iteration-2 add.
2. **No** — agent shortlist is a required deliverable; iteration 1 must include at least a stub.

**Recommendation: option 1.** The pitch's success metric is *"end users prefer the new review flow over the current changed-stories baseline."* That can be met without an agent. Making agent-shipping a hard requirement biases iteration-2 priorities toward the agent regardless of what users say.

Decision: Pending

### **What's the agent's role when it ships?**

Choosing this up front saves 4 weeks of "what should the agent do" debate.

1. **Filter** — pick K stories from N affected. Hides the rest behind "zoom out." Pitch's framing.
2. **Categoriser + presenter** — group all N stories into clusters; show one representative per cluster with rationale; expand to drill in. Nothing is hidden.
3. **Both** — agent filters then categorises.

**Recommendation: option 2.** Filtering is a false-negative cliff and the source of most of the pessimism in the conversation transcript. Categorising is a weaker reasoning task with no false-negative risk — the user always sees every flagged story, just grouped. Also pairs with the deterministic baseline: in iteration 1 the page shows raw modified+affected; in iteration 2 the agent reorders/groups them. Same data flow, agent layer is purely presentation.

Decision: Pending
