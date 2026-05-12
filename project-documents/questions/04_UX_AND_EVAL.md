# UX & Eval

User-facing decisions for the review page, plus the eval methodology that decides whether iteration 2 ships.

---

## UX

### **How do we communicate the uncertainty of the agent's selection?**

The agent will sometimes mis-cluster or mis-rationalise. Framing matters: trust once burned is hard to recover.

The team has already shown its preferred approach to uncertainty: [PR #34701](https://github.com/storybookjs/storybook/pull/34701) hides the `affected/related` icon by default in the sidebar because it produced too much noise. Uncertainty is communicated by *omission*, not annotation.

1. **No uncertainty surface.** Agent's selection is presented as the answer.
2. **Confidence per story.** Each card shows "high / medium / low confidence."
3. **Categorisation with rationale.** Clusters labelled with a short reason; trust comes from the rationale being legible.

**Recommendation: option 3.** LLM-generated confidence numbers aren't calibrated. A short reason string ("changes to button.css affected these stories") is much more useful — gives the user a way to evaluate the agent's judgement and disagree intelligently. This pairs with the categoriser framing from [Page 2](02_DETERMINISTIC_VS_AI.md).

Decision: Pending

### **How does the page handle viewport-specific changes?**

The transcript flagged this: a desktop-only CSS change is invisible if the iframe renders at mobile width.

1. **Status quo.** Half-width side-by-side. Responsive components may render at the wrong breakpoint.
2. **Per-card viewport selector.** Each card has a viewport dropdown.
3. **Stacked mode toggle.** Switch from side-by-side to top/bottom (full-width before above full-width after).
4. **Single-up with baseline ↔ latest toggle.** No side-by-side at all. Each story gets the full preview width; user toggles between baseline and latest.

**Recommendation revised — option 4 in iteration 1.** A separate team conversation (`SECOND_CONVERSATION.md`) independently converged on this design: side-by-side breaks for any non-trivial component because half-width forces awkward viewport choices, and "spot the difference" in two tiny iframes is exactly the visual-diffing UX we promised not to ship. Single-up gives the user the actual breakpoint their story was designed for, and a toggle is the closest no-VRT analogue to "before/after" without trying to render two miniature versions side-by-side.

> If iteration-1 ends up on the **walk-only fork** ([Page 1 §iteration-1 deliverable](01_SCOPE.md#what-is-the-iteration-1-deliverable)), this question dissolves — there's no baseline rendered at all, so no viewport question. Re-open in iteration 1.5 when before/after lands.

Decision: Pending

### **What about complex components and full-page stories?**

The transcript flags this directly alongside the viewport problem: *"side-by-side stuff looks great for a button. But what about a more complex component? What about a page?"*

Half-width side-by-side that works fine for a `Button--default` is too cramped to inspect a `Dashboard--logged-in` story. Stacked mode addresses *breakpoint correctness* but doesn't give the user enough screen real estate to actually read a dense component or page.

1. **Status quo.** Same card layout for all stories regardless of complexity.
2. **Click-to-expand detail view.** A clicked card opens a modal / dedicated view at full viewport width with before/after toggle (instead of side-by-side). User can switch between before/after via tab, keyboard, or slider — and inspect at the actual breakpoint the story was designed for.
3. **Auto-detect dense stories.** Heuristic: if the story's outerHTML exceeds N nodes, default to stacked + full-width for that card.
4. **Single-up at every card.** No detail view needed; every card is already full-width with a toggle. Click-to-expand opens the same content in a dedicated route for sharing.

**Recommendation: option 4** if the viewport question above lands on single-up. The detail view (option 2) then becomes a routing/sharing affordance rather than a layout escape-hatch — same UI surface, different purpose. Option 3 is no longer needed because no card is ever cramped.

> Same walk-only fork caveat applies — if iteration-1 ships latest-only, complex-component layout is "full preview width by default," and the question is dissolved.

Decision: Pending

### **Multi-tab specificity when the agent navigates**

Transcript: *"there could be multiple tabs open. I guess we want only that one particular tab to react to this."*

When `storybook_open_review_page` fires from the MCP, the channel event reaches every connected Storybook tab. Naive behaviour: all of them navigate.

1. **All tabs navigate.** Acceptable for "experimental feature" framing; can confuse users running side-by-side comparisons in two tabs.
2. **Tag the MCP-connected session.** When the MCP tool registers its connection, capture the tab's `sessionId`. The `open_review_page` event carries this ID; only the matching tab navigates. Other tabs ignore.
3. **Tag + fall back to broadcast.** If no tagged session exists (e.g. the agent fires before any Storybook tab connected), broadcast.

**Recommendation: option 3.** Solves the user's actual mental model (the agent should drive the tab they're looking at, not steal another tab's state) without breaking the case where the user opens Storybook *after* the agent fires the event. Implementation cost: ~0.5 days — `addon-mcp` already tracks per-session state for `run-story-tests`.

Decision: Pending

### **How does the user discover the review page exists?**

The toolbar registers a "View changes" button when there are change-detection statuses. The button only appears when there's something to review.

1. **Toolbar button only.**
2. **Toolbar button + sidebar CTA in the existing `ReviewChangesButton` popover.**
3. **Toolbar + auto-redirect when the agent calls `open_review_page`.**

**Recommendation: option 2 + option 3 combined.** Two surfaces double organic discovery. The agent-driven auto-navigation is critical for the AI flow — the user just kicked off Claude in a terminal; they shouldn't have to find Storybook in the browser and click around.

Decision: Pending

### **Cluster acceptance UX (iteration 2 if categoriser ships)**

Meticulous-style "accept one, mark the cluster reviewed."

1. **No accept concept.** Page is read-only.
2. **Local state.** Accepted clusters get visually muted; not persisted.
3. **Persisted state.** Survives reload of the review page.

**Recommendation: option 2.** Persistence has cache-key complexity (per-branch? per-commit? resets when files change?). Local session state captures most of the value with none of the edge cases. Iteration-2 user sessions decide whether to upgrade to option 3.

Decision: Pending

### **How does the user dismiss the agent's recommendation?**

If a user wants the full changeset, not the agent's narrowing:

1. **No explicit dismiss.** User toggles status filter manually.
2. **"Show all" toggle in page header.** Persists for the session.
3. **User-level setting.** Persists across sessions.

**Recommendation: option 2 in iteration 1.** Settings are a rabbit hole; build only if iteration-1 sessions show repeated opt-out behaviour.

Decision: Pending

### **What does the page show when the agent fails?**

Real-world failure modes: rate limit, network error, model error, no MCP connected. Currently the prototype has no agent integration, so this question only matters in iteration 2.

1. **Generic error.** "Agent unavailable."
2. **Graceful degradation.** Page falls back to deterministic baseline (modified+affected as if no agent ran).

**Recommendation: option 2.** The agent layer should be a *enhancement* of the deterministic baseline; if it fails, the user sees the baseline instead of nothing. This is also how the iteration-1 → iteration-2 transition should feel — adding the agent reorders/groups but doesn't replace what's there.

Decision: Pending

### **Cost-fear UX: how do we keep users from being afraid to use the feature?**

The transcript flags this as the project's "users will react negatively" risk: *"people are getting more cautious about token usage… '$10 per request, $20 per request, I'm out of my limit'… that kind of thing. I think it's some worry that we need to think about so that people don't react negatively to this."*

Page 1 cuts cost UI from iteration 1, but the underlying *user perception* problem doesn't go away when we hide the cost. A user who doesn't know what an invocation costs may simply not press the button. This is independent of whether the actual cost is tiny ($0.08–$0.49 measured); the worry is fed by other AI tools' bad reputations.

1. **No cost UI, no cost messaging.** Trust users to know.
2. **Pre-invocation estimate.** Before firing the agent, surface "this will use ~X input tokens, est. $Y on Sonnet / $Z on Haiku." User confirms.
3. **Post-invocation accounting.** After the agent runs, show the actual cost and a session-cumulative total. No pre-confirmation.
4. **Tier-based silent caps.** On low-tier models, automatically downshift to deterministic-only or top-N representatives, with a soft notice. No cost numbers shown.

**Recommendation: option 1 (no cost UI) in iteration 1. Option 3 (post-invocation accounting) in iteration 2 if user sessions show cost anxiety.**

> **Round-2 update.** This recommendation originally said "option 4 (tier-based silent caps on Haiku)." Round-2 §M empirically measured Haiku on small/medium/large with the signature prompt: recall=1, precision=1 across all three, purity comparable to Sonnet, cost $0.065–$0.13. **The tier-based downshift assumption was wrong** — Haiku handles cascade scale fine, just slower (47–80s vs 12–18s on Sonnet). No defensive cap is needed. Cost stays under $0.20 even at the worst measured cascade. Iteration 1 can simply not show cost numbers; if user sessions surface anxiety, iteration 2 shows post-invocation accounting.

Decision: Pending

### **The "feels slow" failure mode (separate from technical perf)**

Iframe pooling ([Page 3](03_TECHNICAL.md)) addresses *technical* slowness. But there's a perception-layer concern from the transcript: *"after scrolling once or twice, it was tremendously slow."* Even with pooling that prevents memory pressure, the page can *feel* heavy if every card boots a fresh iframe and shows a flash of un-styled content for 200ms.

1. **Status quo + pooling.** Trust the technical fix; assume perception follows.
2. **Skeleton placeholders.** Render a card skeleton (story title + spinner) immediately on mount; iframe loads behind. Reduces perceived latency.
3. **Pre-rendered before-state thumbnails.** On first scan, snapshot each story's iframe DOM and render the snapshot immediately; the live iframe loads in the background and replaces the snapshot when ready.

**Recommendation: option 2 in iteration 1.** Skeletons are a familiar pattern from every modern web app; they don't require extra infrastructure. Option 3 has cache-key complexity (when do snapshots invalidate?) that doesn't justify the polish gain in iteration 1.

Decision: Pending

---

## Eval & user sessions

### **How do we get ground truth?**

Eval requires labels: for each (changeset, story) pair, did the story actually change visually?

The pitch lists "no local VRT" as a no-go, but that's about the *product*. Internal-only VRT for eval-time labelling is a different question.

1. **Manual labelling.** ~100 changesets across 3-5 sandboxes; humans label each story yes/no.
2. **Internal VRT pipeline.** Run Chromatic / Playwright / vitest+screenshot per sandbox to generate labels automatically.
3. **No ground truth.** User-session feedback only.

**Recommendation: option 2 + option 1 to spot-check.** Pure gut-feel eval is what got us into this discussion. An internal-only VRT pass is a CI tool, not shipped to users. Reuse Storybook's [37 sandbox templates](https://github.com/storybookjs/storybook/blob/next/code/lib/cli-storybook/src/sandbox-templates.ts) as fixtures — no need to curate external benchmark repos. ~3 days of work.

Decision: Pending

### **What metrics define "the agent is good"?**

Once we have ground truth:

- **Recall** = fraction of truly-changed stories the agent surfaced. *Maximise.*
- **Precision** = fraction of agent-surfaced stories that actually changed. *Secondary.*
- **Cluster purity** (categoriser) = fraction of stories in a cluster that share the same root cause.
- **Time-to-first-finding** = wall-clock from page open to user identifying a real issue.
- **User preference** between flows.

**Recommendation: recall + cluster purity primary; precision secondary; time-to-first-finding + user preference for iteration-2 prioritisation.** Recall is the trust metric — if it's low, users distrust the shortlist and zoom out every time, which means we shipped nothing.

Decision: Pending

### **What recall threshold defines ship?**

Industry intuition:
- Static analysis: ~99% required for trust.
- Heuristic test selection: ~95% acceptable with a CI safety net.
- AI tooling: lower tolerated *if* uncertainty is communicated.

The Chromatic outer loop is our safety net.

1. **≥ 99% recall.** Ship-blocking.
2. **≥ 95% recall.** Ship with explicit "Chromatic catches the rest" framing.
3. **≥ 90% recall.** Ship as experimental, document prominently.

**Recommendation: option 2.** 99% is unrealistic for an LLM-driven feature in 6 weeks. 90% is too low to build trust. 95% paired with honest messaging is the realistic-and-honest band.

**Set this number explicitly before user testing starts** so we don't move goalposts post-hoc.

> **Round-2 update.** Recall has been measured at **100%** on every synthetic scenario (small/medium/large with signature prompt × Sonnet and Haiku) AND on every real-commit replay (8 successful commits from `origin/next`). The signature prompt forces every input story into a cluster by construction — recall is 1.0 by design once the agent parses successfully. **The 95% threshold remains the right *safety margin*** (variance, parse errors, edge cases not yet seen), but should be expected to clear comfortably. The honest framing in the UI ("Chromatic catches the rest") is still warranted even if recall is empirically 100% — variance is non-zero and the next 100 commits might surprise us.

Decision: Pending

### **User-session methodology**

Weeks 3-4 user sessions are the most valuable artefact this project produces.

1. **A/B comparison.** Half see iteration-1; half see existing sidebar with modified+affected filter.
2. **Within-subjects.** Every user uses both flows on the same changeset, counterbalanced.
3. **Open-ended.** Users use the page for a week; we ask afterward.

**Recommendation: option 2.** A/B requires more participants than we'll plausibly recruit. Within-subjects gives preference data with fewer users at the cost of order effects (mitigated by counterbalancing). Open-ended is too noisy.

Plan: 8-12 users, each does 2 sessions of ~45 min, alternating flows on different changesets.

Decision: Pending

### **Who do we recruit?**

The pitch flags this: *"How do we find good users to test with and evaluate this in an unbiased way?"*

1. **Internal only.** Fast; biased toward Storybook-native mental models.
2. **Internal + Chromatic customers.**
3. **External + design-system maintainers.** Most rigorous; will not happen in 2 weeks.

**Recommendation: option 2.** Mix: 3 internal (debug the protocol), 5-9 customers. **Recruitment must start in week 1** — lead-time is real and if it slips, sessions push to week 4 and iteration 2 loses time.

Decision: Pending

### **How do we extend the existing eval system?**

Current eval harness ([`scripts/eval/`](../../scripts/eval/)) is hardcoded to story-writing benchmarks. The trial scaffolding (worktree, agent invocation, PR collection, SQLite) is reusable; the prompts and grader are not.

1. **Fork.** Copy harness to `scripts/eval/inner-loop`; modify freely.
2. **Generalise.** Refactor existing harness for multiple targets, then add inner-loop.
3. **Standalone scripts.** Build separately; integrate later.

**Recommendation: option 3.** Generalising mid-project guarantees both deliverables suffer. Standalone scripts move fast. Track integration as explicit follow-up. With sandbox templates as fixtures, total eval-infrastructure cost is ~3 days, not a week.

Decision: Pending

### **What does an iteration-1 user session actually look like?**

Concrete protocol for a 45-minute session:

1. **5 min** — context: explain what the user is about to do, get consent for screen recording.
2. **15 min, baseline** — ask the user to review changes in a *real* changeset (we use Storybook's own dogfood with a pre-prepared 110-story-cascade `Sidebar.tsx` edit) using the existing sidebar filter only. Observe; ask think-aloud.
3. **15 min, review page** — repeat with a different but similar changeset using `addon-before-after`. Counterbalance order across users.
4. **10 min** — debrief: which felt faster, which felt more trustworthy, what was confusing, would you use this in your team's flow?

**Counterbalancing**: half users see baseline → review page; half see review page → baseline. Same changesets in either order so the cascade size is comparable.

**Real changesets to prepare**: at least three at different cascade scales (small ~10, medium ~110, large ~1,000) so the team can test how each flow scales. We have the dogfood UI for the medium and large scenarios; small scenarios may need a curated synthetic edit.

Decision: Pending
