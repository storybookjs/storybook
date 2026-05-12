# Technical Decisions

Concrete engineering questions for the review page and the MCP layer. Assumes [Page 1](01_SCOPE.md) (two tracks, iteration 1 = deterministic) and [Page 2](02_DETERMINISTIC_VS_AI.md) (categoriser framing).

---

## **Known bugs in PR #34569 — ✅ all fixed**

These were observed live during investigation. Status:

1. ~~**`build-config.ts` references a deleted file.**~~ ✅ **Resolved on `yann/story-review-analysis` already**; the patch was retired (see [FOLLOWUP.md](../FOLLOWUP.md#where-we-are-now-2026-05-10-update--experiments-abc-complete) "the build now works on a clean checkout").
2. ~~**`@storybook/addon-mcp` not installed in dogfood.**~~ ✅ **Now installed AND working.** A subsequent crash (`TypeError: Cannot read properties of undefined (reading 'get')` on `app.get(...)`) was traced to a presets-chain bug in `addon-before-after`: Storybook's `applyPresets` ([`code/core/src/common/presets.ts:301`](../../code/core/src/common/presets.ts)) chains the return value of each `experimental_devServer` hook as the next preset's first argument. `addon-before-after`'s hook fell off the end with no `return`, so the next preset (`addon-mcp`) received `undefined` instead of the express `app`. Fix landed in [`code/addons/before-after/src/preset.ts`](../../code/addons/before-after/src/preset.ts): rename `_app` → `app` and `return app` at every exit point. `POST /mcp` now returns 202.
3. ~~**HMR storm + reload causes `Changes (0)`.**~~ ✅ **Fixed** in [`appendix/patches/02-changes-page-hmr-fix.patch`](appendix/patches/02-changes-page-hmr-fix.patch). Root cause was the UniversalStore follower's `EXISTING_STATE_RESPONSE` arriving during a React StrictMode `useEffect` unsubscribe gap — `useSyncExternalStore` missed the synthesised `SET_STATE` event. Fix: subscribe directly via `experimental_getStatusStore(typeId).onAllStatusChange` plus defensive 50/200/500ms retry-reads to self-heal in adversarial timing. Verified live: 7-sample timeline poll over 6s after reload shows `Changes (110)` from t=0 with no `(0)` transition.

**Worth filing upstream:** the Storybook preset framework's `applyPresets` fold-semantics on `experimental_devServer` is a footgun — every addon author who writes a side-effect-only `experimental_devServer` hook will eventually break the next preset in the chain. Either document explicitly "you MUST `return app`," or change `applyPresets` to keep the previous `newConfig` when a hook returns `undefined`.

---

## **What is the "before" baseline?**

The current prototype defines "before" as **git HEAD**, watching `.git/HEAD` and the current branch ref to invalidate the second Vite environment when the user commits or amends.

This works for one-shot edits. It breaks for an agentic loop: the agent commits/amends multiple times during a feature; after two commits, "before" = the most recent commit, not "before the agent started."

1. **Git HEAD only.** Document the limitation.
2. **Session-pinned at start.** Capture commit SHA when the user opens the review page; pin "before" to that SHA.
3. **Merge-base of current branch with `next`/`main`.** What the user mentally calls "before this whole feature."
4. **User-selectable** via UI control.

**Recommendation: option 3 with HEAD fallback.** When on a feature branch, default to merge-base. When on `next`/`main` (no merge-base), use HEAD. This matches user mental model better and degrades gracefully. Implementation cost: replace `.git/HEAD` watcher with a stored SHA + a manual "rebaseline" hook the agent or user can invoke.

Decision: Pending

---

## **Iframe pooling — required for iteration 1**

**Empirical wall** (live measurements):
- Each iframe costs **~8 MB** browser memory.
- Currently lazy-mounted on first scroll, **never unmounted** ([`LazyStoryList.tsx`](https://github.com/storybookjs/storybook/blob/valentin/before-after/code/addons/before-after/src/components/LazyStoryList.tsx) explicitly says *"Keep-alive: never unmount once mounted"*).
- 75%-cascade scenario (1,212 stories from a `theming/index.ts` edit) in compare mode = 2,424 iframes ≈ 19 GB if user scrolls through. **Tab crashes long before that.**
- Realistic ceiling: ~250-500 mounted iframes before users hit memory pressure.

The previous question docs called this iteration-2 work. The empirical numbers move it to iteration-1 priority.

1. **Status quo.** N iframes for N stories, lazy-mounted but never unmounted.
2. **Fixed iframe pool with channel-driven swap.** ~8-12 visible iframes; off-screen cards swap their assigned iframe via `SET_CURRENT_STORY` ([`core-events/index.ts:17`](../../code/core/src/core-events/index.ts)). The iframe persists; only its loaded story changes.
3. **Hybrid.** Small N (≤16): one iframe per story. Large N: pooled.

**Recommendation: option 2.** The channel-driven swap pattern is already in core's event vocabulary; the addon just isn't using it. This is iteration-1 work because the alternative is shipping a feature that crashes the tab on its primary use case (a wide cascade).

Implementation cost: ~2-3 engineer-days. The iframe pool component manages story-to-iframe assignment based on viewport intersection; iframes communicate via channel; assets share across the pool because all use the same dev server.

Decision: Pending

---

## **MCP tool surface for iteration 1**

The deterministic split ([Page 2](02_DETERMINISTIC_VS_AI.md)) lands three tools:

```ts
storybook_get_change_context(): {
  modified: StoryID[]; affected: StoryID[]; new: StoryID[];
  cssAffected: StoryID[];          // synthesised by reverse-index walking CSS files in diff
  rawDiff: { path: string; hunks: string }[];
  projectShape: { totalStories: number; topNamespaces: { name: string; count: number }[] };
  reverseIndexSlice: { changedFile: string; importingStories: StoryID[] }[];
}
storybook_apply_review_status(story_ids: StoryID[], cluster_id?: string, rationale?: string): void
storybook_open_review_page(filter?: { statuses?: StatusValue[] }): void
```

These live in [`storybookjs/mcp`](https://github.com/storybookjs/mcp). Adding tools is the half-day pattern documented by `run-story-tests` (server.tool + valibot schema + channel-based request/response).

The `cssAffected` field is the deterministic gap-filler: for each `.css/.scss/.sass/.less` file in the git diff, walk the existing reverse-index for sibling JS files in the same directory and union the importing stories. Purely deterministic, no AI.

1. **Single bundled call** (above).
2. **Multiple narrow calls** (one per concern: get-modified, get-diff, get-shape).
3. **Just `get_change_context`; agent handles the rest via filesystem reads.**

**Recommendation: option 1.** Token cost differs by an order of magnitude between option 1 and option 3 on a 2,000-story repo. Single bundled call also makes deterministic UI consumers (e.g. a "smart filter" sidebar widget) trivial — they read once, render. Multiple narrow calls add round-trip latency for no clarity gain.

**Cross-repo coordination required.** Plan time for it; `storybookjs/mcp` has open auth/memory bugs ([#211](https://github.com/storybookjs/mcp/issues/211), [#214](https://github.com/storybookjs/mcp/issues/214)) that may surface during integration.

Decision: Pending

---

## **Status taxonomy: where does `agent-recommended` fit?**

`StatusValue` ([source](../../code/core/src/shared/status-store/index.ts)) is currently `new | modified | affected | warning | error | success | pending | unknown`. (Note: `affected` is internal; renamed to `related` in user-facing copy per [PR #34652](https://github.com/storybookjs/storybook/pull/34652).)

A story can have multiple status entries by `typeId`. Adding `agent-recommended` raises the question of how it composes.

1. **Independent dimension.** Separate filter axis. User combines.
2. **Subset of affected.** Enforced via MCP tool: reject `apply_review_status(id)` if `id` not in `modified ∪ affected ∪ new`.
3. **Replaces affected.** When agent-recommended is set, hide `affected`; show only `modified` + `agent-recommended`.

**Recommendation: option 2.** The agent should never recommend a story not already flagged by change-detection — that would mean hallucinating relevance. Subset enforcement gives a free invariant check. Cluster info goes in `status.data: { clusterId, rationale }` (this pattern is already used by the a11y addon, see [`A11yContext.tsx`](../../code/addons/a11y/src/components/A11yContext.tsx)).

Decision: Pending

---

## **env=before correctness — verified live**

Three concerns were open before measurement. All resolved positively:

**Cold-start latency:** comparable to env=after. Measured loadMs ~110-160ms for both paths across 5 different stories; total time-to-rendered-content ~660-690ms. Heavy stories (Sidebar, manager-main, accessibility-panel) within 10% of each other; before sometimes faster (cache priming benefit).

**Play functions / decorators / args:** confirmed identical to env=after. Loaded `button-component--disabled` (which has a play function calling `button.focus()` with `expect()` assertions) in both iframes. Both rendered with `aria-disabled="true"` AND `isFocused: true` — the focus is a side-effect of the play function. Args, decorators, and the entire preview pipeline run in env=before exactly as in env=after.

**Addon code (Chromatic VTA, a11y, themes) in env=before:** runs at *currently installed* version, not HEAD version. The Vite optimizeDeps cache is shared (`noDiscovery: true`) — both iframes use the same pre-bundled deps. Direct `/node_modules/...?env=before` requests return 500 (not used in real iframe loads, gracefully ignored).

**Implication:** "before" semantics are precise for first-party code (HEAD), but addon-version-dependent rendering may not differ between before and after. This is fine for the typical use case (compare your component change) but could be confusing if a user upgraded `@chromatic-com/storybook` mid-session and expects to see addon-driven differences.

Add to addon README: *"The `before` view reflects HEAD-version of your project's source code, but addon code is always at currently-installed versions."*

Decision: Pending (acknowledge)

---

## **Vite version requirement**

The env-API path requires **Vite ≥ 6**. The prototype's [circuit breaker](https://github.com/storybookjs/storybook/blob/valentin/before-after/code/addons/before-after/src/node/circuit-breaker.ts) throws `BeforeAfterUnsupportedViteError` on Vite 5.

The latest commit on the PR branch removed the subprocess fallback, so **Vite 6+ is now a hard requirement** for the addon. Webpack-based frameworks (Next.js pre-15, Angular CLI, react-webpack) are unsupported.

1. **Document, ship Vite-only.**
2. **Build a webpack-based "before" server in parallel.**

**Recommendation: option 1.** Webpack is on a deprecation glide path; building a parallel architecture for an experimental feature is not justified. Document prominently in the addon README.

Decision: Pending

---

## **How does the addon open the review page in the user's running Storybook?**

The agent has two paths to open the page:

1. **Channel event from the MCP.** `storybook_open_review_page` emits a channel event; running Storybook subscribes; every connected tab navigates to `/changes`.
2. **Print clickable URL in agent transcript.** User clicks.
3. **Browser-control MCP** (Chrome DevTools, Playwright). Agent drives the browser.

**Recommendation: option 1 with option 2 as a fallback** when no Storybook channel is connected. Driving the user's browser from a CLI agent is fragile and Chrome-specific. Multi-tab is a minor concern — most users have one Storybook tab open; if many, all of them navigating is acceptable behaviour for an experimental feature.

Decision: Pending

---

## **What happens when the agent's input has known blind spots?**

Change-detection has structural blind spots ([Page 2](02_DETERMINISTIC_VS_AI.md)). The deterministic CSS-blast-radius lookup mitigates the biggest one. For the rest:

1. **Document, accept.** Type-only / `.d.ts` / regex-aliased / node_modules edits emit no signal.
2. **Synthesise pseudo-statuses for all known blind spots.** For each blind-spot category, add a deterministic lookup that produces a status with metadata explaining the synthesis basis.
3. **Surface the gap to the user.** Show a banner: "Your diff includes N CSS / type / node_modules files. Change-detection cannot trace these — review them manually in `git diff`."

**Recommendation: option 2 for CSS only (since the lookup is cheap and the gap is biggest); option 1 for the others.** Type-only and `.d.ts` files genuinely don't have observable effects most of the time; node_modules diffs are out of scope; regex-aliased barrels are a workspace-config quirk users can fix by switching to string aliases.

Decision: Pending

---

## **Does the addon depend on `FEATURES.changeDetection`?**

The change-detection backend is gated behind [`FEATURES.changeDetection`](../../docs/configure/user-interface/change-detection.mdx). Without it, no statuses flow.

The addon needs change-detection to be useful. Options:

1. **Soft dependency.** Addon installs cleanly without `FEATURES.changeDetection`; shows an empty state explaining the requirement.
2. **Hard dependency.** Preset enforces `FEATURES.changeDetection: true` or errors at boot.
3. **Auto-enable.** Preset sets `FEATURES.changeDetection: true` if not explicitly set.

**Recommendation: option 3.** The user installed the addon expecting it to work; surprising them with a feature-flag requirement creates friction. Auto-enable in the preset, allow explicit opt-out via `FEATURES.changeDetection: false`. Document the implicit enable in the addon README.

Decision: Pending

---

## **Telemetry from day one**

[PR #34533](https://github.com/storybookjs/storybook/pull/34533) added sidebar filter telemetry for change detection. The addon should match.

Events worth capturing:
- `review-page-opened` (with cascade size)
- `review-page-closed` (with time-on-page)
- `compare-mode-toggled`
- `agent-recommended-applied` (when iteration 2 ships)
- `iframe-pool-resized` (if pooling)

1. **Match existing patterns from day one.**
2. **Defer telemetry to iteration 2.**
3. **Skip entirely** (experimental feature, no telemetry).

**Recommendation: option 1.** Without telemetry we have no quantitative signal on whether users are using the page after the user-session study. Match existing event shapes so they aggregate together with sidebar-filter events.

Decision: Pending

---

## Summary

The technical work for iteration 1, in priority order:

1. ~~**Fix the PR bugs**~~ ✅ all three are resolved (see top of this page).
2. **Iframe pooling.** 2-3 days. Required for the cascade case.
3. **Session-pinned baseline (merge-base).** 1 day. *Round-2 note:* the dominant case is 70.4% single-modified; merge-base baseline matters most for agentic loops (multi-commit feature work), less for one-shot edits.
4. **MCP tool surface (cross-repo).** 2-3 days.
5. **`agent-recommended` status value + cluster-data carrier.** 1 day.
6. **CSS blast-radius synthesised lookup.** 1-2 days. *Round-2 note:* prototype exists in [`scripts/eval/inner-loop/lib/css-blast-radius.ts`](../../scripts/eval/inner-loop/lib/css-blast-radius.ts) and works; it just needs wiring into the addon's preset. Known precision caveat documented in the prototype.
7. **Telemetry.** 0.5 days.

Total: ~7-10 engineer-days for iteration 1 (down from ~9-12 since the PR bugs are already fixed). Two engineers can finish in a week with parallel work.
