# Scope, Positioning & Non-Goals

Strategic shape of the project. Answer these before kickoff; the rest of the decisions follow.

> **Round 2 update.** When this page was written the agent layer's *feasibility* was the principal risk and the main reason to keep Track B (agent shortlist) on a separate success bar. Round 2 measurements ([Page 0](00_README.md#round-2-may-1011--empirical-findings-that-change-project-shape)) show the agent layer DOES work — recall=1, precision=1 across synthetic and real-commit replays once the signature-prompt design is used. **The two-tracks recommendation still stands, but the reason has shifted from "agent might not work" to "user-session results should drive iteration-2 design, not be confounded by iteration-1 agent quirks."** Same recommendation, narrower uncertainty.

---

## **Two tracks or one project?**

The pitch ([INNER_LOOP.md](../INNER_LOOP.md)) packages two deliverables together: a focused review page UI, and an agent that selects which stories to review. After investigating the codebase, these share almost no technical risk and have very different shippability profiles.

The review page already has a working prototype in [PR #34569](https://github.com/storybookjs/storybook/pull/34569) (`@storybook/addon-before-after`). The change-detection backend that feeds it is shipped behind `FEATURES.changeDetection`. The sidebar entry-point exists. **The review page is engineering**, with two known shippable-quality bugs to fix and one urgent perf fix (iframe pooling).

The agent shortlist has zero implementation, no eval harness, and lives upstream of an open research problem. The transcript already lands here — Yann calls the agent piece "the stretch slash spike."

1. **Single project, single bar.** Both deliverables must work for the project to succeed. A weak shortlist drags down a finished review page.
2. **Two tracks, separate bars.** Track A (review page) commits to shipping experimental in 10.5 regardless of agent quality. Track B (agent shortlist) commits to *learning* — ship if positive eval, otherwise hand off as research.
3. **Sequential.** Build the review page first; only start the agent work after the review page is functional and validated.

**Recommendation: option 2.** They share a UI surface but nothing else technically. Conflating them creates a situation where hard-to-measure agent quality blocks an otherwise shippable UI. The 6-week cadence (prototype → user feedback → iterate) maps cleanly onto two parallel tracks.

Decision: Pending

---

## **Where is the cut between inner loop (Storybook) and outer loop (Chromatic)?**

The transcript surfaces this directly: *"if we would be so exact as the algorithm provides us in terms of figuring out which exact stories have changed, we wouldn't need chromatic anymore... So where's the cut?"*

The more accurate the inner-loop signal becomes, the more it cannibalises Chromatic's positioning. The less accurate it is, the less reason a user has to use it instead of running Chromatic in CI.

1. **Inner loop = fast and lossy, outer loop = definitive.** Inner-loop is explicitly a *triage* tool. Chromatic remains the source of truth.
2. **Inner loop = good enough to skip Chromatic for small teams.** Targets parity with Chromatic on a meaningful subset.
3. **Inner loop = preview for outer loop.** Catch issues before opening a PR; Chromatic catches what was missed and brings in non-engineering reviewers.

**Recommendation: option 3, marketed as option 1.** This matches reality — the inner loop will not be perfect, and Chromatic's value (cross-functional review, snapshot history, regression baselines) is independent of detection accuracy. Marketing emphasises speed and triage, not authority. This also keeps the eval bar honest: we're not trying to beat Chromatic on accuracy, we're trying to beat "user manually browsing the sidebar" on speed-to-first-finding.

Decision: Pending

---

## **What is the iteration-1 deliverable?**

The 6-week experimental cadence is: weeks 1-2 ship a working prototype; weeks 3-4 user sessions; weeks 5-6 ship iteration 2.

For this project, weeks 1-2 has two plausible shapes:

A. Polish PR #34569 + simple deterministic MCP tool ([Page 2](02_DETERMINISTIC_VS_AI.md)). No agent. Users see modified+affected stories on the review page, fed by change-detection alone.

B. Wire in agent shortlist end-to-end on top of the prototype, even with a weak signal.

1. **Iteration 1 = polished review page + deterministic tool.** Agent integration deferred to iteration 2.
2. **Iteration 1 = end-to-end agent → shortlist → review page.** Even if the agent picks badly, users see the full flow.
3. **Iteration 1 = both, in parallel.**

**Recommendation: option 1.** User sessions in weeks 3-4 are the single most valuable artifact this project produces. If iteration 1 includes the agent and it picks badly, every session is dominated by "the AI is wrong" feedback and we learn nothing about the review page itself. Better: land the polished review page + a deterministic MCP tool first, validate UX, *then* layer the agent in for iteration 2 — by which point users will have told us what makes a story "worth reviewing."

There's a real possibility user sessions conclude that the deterministic flow + a focused review UI is sufficient. **That outcome is a successful 6-week bet, not a fallback.**

> **Sub-fork inside option 1.** A separate team conversation (`SECOND_CONVERSATION.md`) raised a plausible simplification: iteration-1 could be **walk-only** (cluster-organised story walk, latest-only, no before/after) rather than **with-baseline** (single-up with baseline ↔ latest toggle, requires iframe pool work).
>
> - **Walk-only fork** drops the riskiest engineering (iframe pool, env=before iframe correctness, viewport/theme management) from iteration-1's critical path. Aligned with the 70%-single-modified data: most edits don't need a visual diff to be useful, the user is comparing against their own mental model. The user can still toggle in and out of the existing Storybook to manually compare if they want.
> - **With-baseline fork** matches the pitch's D3 literal deliverable ("before and after states in one place") but requires iframe pool with eviction (each iframe ~8 MB, cascade-mode = tab crash without it) and resolves none of the page-level/viewport/theme caveats raised in [Page 4](04_UX_AND_EVAL.md).
>
> **Recommendation: walk-only as iteration 1, with-baseline as iteration 1.5** once iframe pool work has a stable design. Three reasons: (a) the 70%-single-modified statistic; (b) the no-VRT constraint means baseline rendering is the most failure-prone surface; (c) shipping a leaner v1 keeps the door open to learn what users actually do before committing engineering to the harder piece.
>
> If the team prefers with-baseline anyway: use **single-up with toggle**, not side-by-side. Side-by-side breaks for page-level stories and viewport-specific components — same conclusion the team conversation reached independently.

Decision: Pending

---

## **Core feature or addon?**

The PR ships as `@storybook/addon-before-after`. The pitch lists this as an open question.

Constraint: the prototype boots a second Vite environment (env-API path; Vite 6+ required). Webpack-based frameworks cannot use this approach without parallel implementation.

1. **Core feature, Vite-only initially.**
2. **Addon, multi-builder.**
3. **Addon now, promote to core later.**

**Recommendation: option 3.** Addons are cheaper to iterate on and survive being un-shipped without a deprecation cycle. Revisit at end of week 6 informed by user feedback.

Decision: Pending

---

## **Hard non-goals**

These are settled. Calling them out so they don't get re-debated mid-project.

| Non-goal | Why |
|---|---|
| **Per-test Vitest coverage** | Genuinely unsolved in 2026 industry-wide. Confirmed via [vitest-dev/vitest #5237](https://github.com/vitest-dev/vitest/issues/5237). |
| **Local production VRT** | Explicitly listed in pitch. Internal-only VRT *for evals* is OK ([Page 4](04_UX_AND_EVAL.md#how-do-we-get-ground-truth)). |
| **Solving cross-business-logic reference tracing** | Industry problem (Serena, Graphify, ContextMem all attempt it; none solve it). Storybook is not the right vehicle. |
| **Webpack-based builder support in iteration 1** | env-API path requires Vite 6+. Webpack support requires a parallel architecture entirely. |
| **Persistent review state across sessions** | Cache-key complexity. If iteration-1 sessions ask for it, build in iteration 2. |
| **Cost UI in iteration 1** | Round 2's Haiku measurements ([Page 4 §"Cost-fear UX"](04_UX_AND_EVAL.md#cost-fear-ux-how-do-we-keep-users-from-being-afraid-to-use-the-feature)) show Haiku works at every cascade scale at comparable cost. Tier-aware behaviour isn't needed at the model level; cost stays under $0.20 even at the cascade case. Surface cost numbers in iteration 2 if user sessions ask. |
| **Replacing change-detection with agent reasoning** | Module graph + reverse index is the deterministic foundation. Agent layers on top. See [Page 2](02_DETERMINISTIC_VS_AI.md). |
| **MCP tools for non-React renderers in 10.5** | `@storybook/addon-mcp` is React-only during preview. Vue/Svelte/Angular users get the review page only. |

---

## **Accepted caveats (real limitations we ship with)**

These are known weaknesses we accept because the cost of fixing them exceeds the cost of documenting them.

- **CSS files are invisible to change-detection.** The agent compensates via raw git diff. See [Page 2](02_DETERMINISTIC_VS_AI.md).
- **`.d.ts` auto-included files are invisible.** Out of scope.
- **Regex-aliased barrels track as opaque-leaf.** Some monorepos (including Storybook's own dogfood) use regex aliases that oxc-resolver can't follow. Changes to those packages emit no signal — confirmed live with `storybook/test`: 0 cascade.
- **node_modules changes are out of scope.** Library version bumps don't flow.
- **Change-detection requires git.** Non-git workspaces unsupported.
- **Vite 6+ is a hard requirement** for the env-API path.
- **The agent is non-deterministic.** Two runs on the same diff may differ. Evals report distributions, not point estimates.
- **False negatives are intrinsic to filter-based selection.** Even at 95% recall, 1 in 20 truly-changed stories is hidden. Chromatic outer-loop is the safety net.

---

## **Pre-kickoff checklist**

| # | Decision | Page | Why now |
|---|---|---|---|
| 1 | Two tracks or one? | This page, Q1 | Defines what "iteration 1" means |
| 2 | Iteration-1 deliverable | This page, Q3 | Locks weekly priorities |
| 3 | Recall threshold | [Page 4](04_UX_AND_EVAL.md) | Without this, ship/hold has no defensible basis |
| 4 | Eval-time VRT acceptability | [Page 4](04_UX_AND_EVAL.md) | Without ground truth, no eval; without eval, iteration 2 is a guess |
| 5 | Baseline strategy | [Page 3](03_TECHNICAL.md) | PR's git-HEAD baseline is broken for agentic loops |
| 6 | User-session recruitment lead | [Page 4](04_UX_AND_EVAL.md) | Lead-time real; if recruitment slips, iteration 2 loses time |
