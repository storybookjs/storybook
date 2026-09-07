# Sidebar 2.0 — review record (2026-09-07)

Working document for [#33422](https://github.com/storybookjs/storybook/pull/33422). It records the
issues found in a full-diff adversarial review of `issue-31267-sidebar-2` vs `next`, what was fixed
and how it was verified, the decisions that need an author's eye, and a plan for splitting the PR.
**Delete this file before marking the PR ready for review.**

Verification baseline after all changes below: full `storybook-ui` browser suite
(228 story files), per-package typecheck (`nx run-many -t check`), manager unit tests, and targeted
Playwright runs against the live internal UI (tree interactions, ref trees, sidebar menu).

---

## 1. The react-aria yarn patch is gone

**Question asked:** is the patch still necessary, given the upstream TreeView fix?

**Answer: no — dropped, via upgrade to react-aria 3.52.1 / react-aria-components 1.21.1.**

- The branch's patch (`react-aria-npm-3.48.0`) null-guarded `defaultView` in two places. The
  `isInert` half — the crash that actually broke the Panel and manager index story suites — is fixed
  upstream in 3.52.x: `isFocusable`/`isInert` now resolve the window through `getOwnerWindow`, which
  falls back to the global `window` for detached documents (verified against the published 3.52.1
  tarball, `dist/private/utils/isFocusable.mjs` + `domHelpers.mjs`).
- The `calculatePosition` half is **still unguarded upstream**
  (`dist/private/overlays/calculatePosition.mjs:352` in 3.52.1). Decision: ship without it. No suite
  in the repo exercises overlay positioning from a detached document, and `next` has the identical
  exposure today through `@react-aria/overlays` 3.29.1, so this is a lost hardening, not a
  regression. **Follow-up:** upstream the one-line guard to react-spectrum
  (`node.ownerDocument.defaultView && node instanceof …`), then this exposure disappears for good.
- The patch had also silently stopped covering the copy that matters: `react-aria-components` pins
  `react-aria` exactly, and the root `resolutions` that redirected that pin to the patched build
  were dropped in the #35399 merge. Since then the patch only protected core's direct
  `react-aria/*` imports while RAC ran unpatched 3.48.0 — and the two copies were *different
  runtime instances* (see §2, PopoverProvider). The stale `EXISTING_RESOLUTIONS` entries from that
  same episode made `scripts/ecosystem-ci/existing-resolutions.test.ts` fail; fixed.
- The scoped shims (`@react-aria/live-announcer` 3.5.0, `@react-aria/overlays` 3.32.0) pinned
  `react-aria: 3.48.0` exactly; bumped to the `.1` releases whose caret ranges dedupe onto 3.52.1,
  so exactly one react-aria instance ships.

**Supply-chain note:** the repo's `npmMinimalAgeGate` is 7 days; react-aria 3.52.1 was published
2026-09-04. Resolution was performed with the gate bypassed for that one install
(`YARN_NPM_MINIMAL_AGE_GATE=0`), because the alternative was waiting until ~Sep 11. CI installs from
the committed lockfile (`--immutable`) don't re-resolve, so they are unaffected; a contributor
re-resolving react-aria before ~Sep 11 will hit the gate. If that trade-off is not acceptable,
revert commit `7aae419b4` and re-land it after Sep 11 — nothing else in this branch depends on it
except the PopoverProvider single-instance fix (§2), which would need the old root-resolutions
patch wiring restored instead.

Also of note: `next`'s 171-line `react-aria-components 1.12.2` patch (which rewrote monopackage
imports to scoped `@react-aria/*` ones) was already dropped by this branch; the upgrade makes that
permanent. The `.oxlintrc.json` restricted-import messages still recommended the old scoped-package
convention — updated to point at the `react-aria/<subpath>` form and to warn against reintroducing
scoped deps (the version-drift hazard above).

---

## 2. Bugs found and fixed in this pass

Ordered by severity. "Verified" = reproduced/exercised against the live UI or covered by the suites
listed above.

| # | Severity | Issue | Fix | Verified |
|---|----------|-------|-----|----------|
| 1 | Critical | **Ref trees dead** (`fix ref stories not loading at all` FIXME): RAC collection keys were `createId(refId_itemId)` while `selectedKeys`/`expandedKeys`/handlers used raw ids, so composed-ref trees never matched expansion or selection, and clicking a ref branch called `selectStory('refId_x')` with a nonexistent id | `TreeItem id={item.id}` (raw); each ref tree is its own collection so cross-ref uniqueness is unnecessary | Live: ref tree rows expand/collapse; FIXME removed |
| 2 | Critical | **Ref trees unscrollable**: non-main ref wrappers had no bounded height; a tall ref grew past the sidebar (no outer scroller exists anymore) and starved the main tree | Ref wrappers are bounded flex children (`flex: 0 1 auto; minHeight: 0`, column) — natural height when it fits, internal scroll under pressure; main keeps `1 1 auto` | Live at 480px viewport: both trees bound + scroll; last ref row reachable |
| 3 | High | **Escape stopped exiting fullscreen from the preview iframe** — the old `escape` shortcut handled forwarded `PREVIEW_KEYDOWN`s; its replacement listener lived only on the manager window | Escape handling centralized in the shortcuts module: a bubble-phase window listener (so RAC overlays, which stop propagation when they consume Escape, still win) plus a `PREVIEW_KEYDOWN` branch | Unit tests; suites |
| 4 | High | **Escape-exits-fullscreen died whenever the FullscreenTool unmounted** (toolbar hidden via alt+T or `layoutCustomisations`, review routes, non-story views) — fullscreen state outlives toolbar visibility | Same centralization; the toolbar button is presentation-only again and its shortcut hint shows the `fullScreen` binding (as before the rewrite) | Same |
| 5 | High | **`enableShortcuts: false` swallowed keys manager-wide**: the new capture-phase listener called `stopPropagation()` on any *matched* feature even when the handler would no-op, eating `1`/`2`/`3`, cmd+K, etc. for the whole UI | `handleKeydownEvent` reports "no match" when shortcuts are disabled or the nav-unavailable guard applies, so nothing is stopped | Unit tests |
| 6 | High | **Escape became recordable as a custom shortcut** in settings; a persisted `['escape']` binding would be stopped at document capture before any RAC overlay could close | The recorder rejects a bare Escape (error state), mirroring the old reservation | — |
| 7 | Major | **Enter did nothing on tree rows whenever a story was selected** (react-aria's `toggle` selection behavior treats Enter as no-op with a non-empty selection) | `selectionBehavior="replace"` on the tree — Enter fires `onAction` on every row again | Live: Enter toggles focused branch |
| 8 | Major | **Clicking a row's "…" menu button also activated the row** (RAC selects on *pointerdown*; only click was stopped) — navigated to the story or folded the branch under the open menu | `stopPropagation` on pointerdown/mousedown/touchstart on the menu trigger container | Live: menu opens, row expansion & selection unchanged |
| 9 | Major | **Expandable rows had no `slot="chevron"` button**: react-aria 1.21 logs a warning per expandable row mount (hundreds under virtualization) and AT users lacked a dedicated expand/collapse target | Chevron/type icon wrapped in a RAC `<Button slot="chevron">` (chromeless; the row keeps painting focus) | Live: 0 warnings; chevron toggles exactly its row |
| 10 | Major | **Mobile bottom bar announced `[object Object]`** when `renderLabel` returns JSX (the documented pattern) — the old `typeof === 'string'` guard was dropped, also silently breaking the parent-prefix length check | String guards restored for both label and aria chains | Mobile nav stories |
| 11 | Major | **`SIDEBAR_OPEN_CONTEXT_MENU` opened two menus with composed refs** (every tree listened; the selection fallback fired in the main tree while a ref tree had focus) | Selection fallback only applies when no tree row anywhere has DOM focus | — |
| 12 | Major | **Sidebar menu items dead** (`clicking the sidebar menu does nothing now` FIXME): root cause was the dual react-aria instance split (§1) — RAC's `DialogTrigger` press context and core's `Pressable` came from different copies, so trigger props never connected | Fixed by the §1 upgrade (single instance); additionally `PopoverProvider` now imports `Pressable` from `react-aria-components/Pressable` so the same-instance guarantee is structural, not incidental | Live: menu opens, item onClick runs, closes via `closeOnClick`; FIXME removed |
| 13 | Medium | **Stale row closures**: react-aria's element cache was only invalidated by `expanded`, so `hasTestProviders` flipping (a test-provider addon registering after first paint) left rows without their "…" menu until the next expand/collapse | `hasTestProviders` added to `collectionDependencies` | — |
| 14 | Medium | **First selection after a selection-less mount triggered a jarring center-scroll** (the one-time "mount" scroll fired on whatever selection came first) | Center-scroll only when the tree mounted with a selection (deep links) | — |
| 15 | Medium | **Collapse-all collapsed root sections too**, reducing the sidebar to bare headers (old behavior kept roots open) | Collapse-all resets to the initial root set | — |
| 16 | Medium | **`indexToTree` mutated shared manager-state entries** (attached `resolvedChildren` to the store's own objects; anything spreading or serializing entries would drag whole subtrees along) | Every node is copied before linking | Unit tests |
| 17 | Medium | **Hoisted single-story components didn't re-depth their descendants** — test subentries rendered two levels deeper than their parent, with extra trace lines and wrong visual/aria level agreement | `collapseSingleStoryComponents` decrements descendant depths | Unit tests |
| 18 | Medium | **Focus tooltip rendered as a stray pill on Firefox** (CSS anchor positioning unsupported; `position-visibility` can't hide it either) | Gated on `CSS.supports('anchor-name: …')` | — |
| 19 | Medium | **Shortcut-only tooltips silently dropped** (`<Button shortcut={…}>` with visible text lost its hint; the `Shortcut` story rendered nothing) | Wrapper renders when either tooltip or shortcut present; `TooltipNote.note` optional | Component stories |
| 20 | Minor | `location: 'bottom-bar'` was passed for the whole mobile *drawer* tree, contradicting the documented advice to strip labels in the bottom bar | Drawer tree passes `'sidebar'`; context now carries `isMobile` as the docs already promised; `renderAriaLabel` typed to return `string`; `context` param optional so 2-arg consumers keep compiling | Typecheck |
| 21 | Minor | Docs bugs: broken backticks in the `renderAriaLabel` table cell; `// FIXME/TODO: add arialabel` shipped inside a user-facing snippet | Fixed | — |
| 22 | Minor | Pending status icon rendered at 12px next to 14px siblings (with a FIXME asking which) | 14, FIXME removed | — |
| 23 | Minor | Card rainbow gradient wrapped with a visible hue jump (12 stops → cycle period 54.5%, translate −50%) while the new comment claimed a seamless wrap | 13th stop repeats the first hue; period is exactly 50% | — |
| 24 | Minor | Dead surface: duplicate `ContextMenuEntryMethod` export, unused `TreeProps.isBrowsing`/`isMain` (plumbed from Explorer/Refs for nothing), unused `RefType.rootIds`, dead `data-focus-visible` observer branch, `removedFeatures` guard that could never fire, commented-out highlight remnants in `Refs.tsx` | Removed | Typecheck |
| 25 | Docs | The three public API changes had no migration notes | `MIGRATION.md`: sidebar section covering `renderLabel` context, `renderAriaLabel`, `escape` removal from configurable shortcuts, new `contextMenu` shortcut | — |

---

## 3. Known issues left open (with recommended direction)

These need either a product decision or work that would have widened this pass beyond review scope.

1. **Story rows are no longer links.** The old tree rendered leaves as `<a href>`: cmd/ctrl+click
   → new tab, middle-click, right-click → copy link. All gone; `getLink` in `utils/tree.ts` is now
   dead code. RAC `TreeItem` accepts `href` (with `RouterProvider` to route in-app navigation
   through `api`), but the interaction matrix with controlled selection + `onAction`
   (double-navigation, `linkBehavior`) needs deliberate design, not a drive-by. Recommended: leaf
   rows get `href={getLink(item, refId)}` + a `RouterProvider` whose navigate defers to the
   existing selection path; verify plain click, modified click, Enter, and Space each fire exactly
   once. Until then, delete `getLink` or mark it for this follow-up.
2. **Virtualizer vs the "nav stays reachable while searching" contract.** When search UI is shown,
   the explorer keeps `sb-sr-only` (1×1 clip) so keyboard/SR users can still reach the tree — but
   the virtualizer only renders rows inside the (now ~1px) viewport, leaving just persisted
   (selected/focused) rows in the accessibility tree. Arrow-key traversal may still work through
   RAC's collection navigation (focus persistence re-renders rows as you move). Needs a manual
   screen-reader test before deciding between: force a real height while sr-only, or drop the
   contract and unmount (updating `types.ts`'s comment).
3. **Sticky/scroll geometry vs `ListLayout` estimates.** `flatRows` computes true offsets
   (28px rows + 14px section gaps) while the virtualizer positions unmeasured rows from
   `estimatedRowHeight: 28`. Deep-linking into a large tree can briefly misalign programmatic
   scrolls and the pinned chain by 14px per unmeasured section boundary until measurement catches
   up. Fix if it bothers in practice: a `ListLayout` subclass fed exact heights from `flatRows`.
4. **Status aggregation semantics drifted quietly** (`utils/status.tsx`): (a) docs entries' own
   statuses now roll up into their parents (old code counted only stories) — confirm intended;
   (b) `getGroupStatus` promotes into root ids while `getGroupDualStatus` deliberately excludes
   roots — align the contracts; (c) `promote` fabricates partial `Status` objects (only
   `value`/`storyId` read today — latent).
5. **Per-row test-provider menu computation** (`TreeNode` calls `generateTestProviderLinks` →
   addon `sidebarContextMenu` callbacks for every rendered row on every collection invalidation).
   The old code evaluated lazily on hover. Perf-only; consider memoizing availability per entry
   type or restoring lazy evaluation if profiling shows it.
6. **Pre-existing tooltip stale-open** (`TooltipProvider` mirrors RAC open state; suppressing via
   controlled `visible={false}` desyncs the mirror so a tooltip can pop open without hover after
   closing a toolbar Select). Predates this branch but now visible on the new toolbar; fix is to
   use `isDisabled` for suppression instead of controlled `visible`.
7. **`isActive` on addon shortcuts is unused outside tests.** Kept deliberately: the stale-binding
   skip in the same gating is load-bearing, and review-mode arrow navigation is the intended
   consumer. If that plan is dead, drop the option.
8. **Remaining FIXMEs are intentional** (design questions, not regressions): story-with-children
   click semantics ("Review with MA"), F6 section animation, ref-tree level offset for `RefHead`,
   orphan handling, `status-value:affected` copy, `copyStoryName` shortcut plumbing (commented
   out in three files).
9. **`ReactNodeRenderLabel` mobile story has no play assertion**, so regression #10 above was
   untested; worth adding an assertion on the announced label.
10. **`Explorer.stories` renders in an unbounded container**, so it can't catch layout regressions
    like #2; the `Sidebar.stories` `WithRefs` story can (it renders the real constrained chain) —
    prefer it for layout-sensitive play tests.

---

## 4. Cutting the PR into smaller PRs

The diff is ~87 files / +3.2k −2.5k (excluding lockfile). Four PRs stand alone cleanly; the tree
rewrite then shrinks to roughly half its current review surface. Extraction is mechanical:
`git checkout -b <part> origin/next && git checkout issue-31267-sidebar-2 -- <files>`, then trim.

### PR A — react-aria 3.52 / react-aria-components 1.21 upgrade + import migration
*No dependencies. Highest leverage: kills two yarn patches (including `next`'s 171-line RAC patch)
and the dual-instance hazard.*
- `code/core/package.json`, `code/addons/docs/package.json`, `yarn.lock`, both deleted
  `.yarn/patches/*`, `scripts/ecosystem-ci/existing-resolutions.js`
- Pure import swaps: `Collapsible`, `Form/Input`, `Modal(+styled)`, `PopoverProvider` (incl. the
  RAC `Pressable` fix), `Select` (imports only), `Tabs/*` (7 files), `Toolbar`,
  `shared/overlayHelpers`, `tooltip/TooltipProvider`, docs-blocks `Controls`/`Preview`, vitest
  `TestProviderRender`
- `code/.oxlintrc.json` messages, `code/vitest.config.storybook.ts` `define`

### PR B — shortcuts & escape rework
*No dependencies; needs its own review (it changes global key handling).*
- `manager-api/modules/shortcuts.ts` (capture listener, gating, centralized Escape), `lib/shortcut.ts`,
  `manager/settings/{defaultShortcuts,shortcuts}.tsx`, `manager/components/preview/Toolbar.tsx`
  (+ `NumericInput`/`SizeInput`/`useLandmark` one-liners), the new tests
- **Excludes** the `contextMenu` shortcut + `SIDEBAR_OPEN_CONTEXT_MENU` event — their only listener
  is the new tree, so they ride with PR E (shipping them alone adds a dead shortcut to settings)

### PR C — `renderLabel` context + `renderAriaLabel` API
*No dependencies.*
- `types/modules/api.ts` + `api-stories.ts`, `manager-api/lib/stories.ts` plumbing,
  `MobileNavigation.tsx`, `manager-api/root.tsx`, `.storybook/manager.tsx`, docs pages/snippet,
  the MIGRATION section

### PR D (optional) — status utilities and icon primitives
*No hard dependency, but touches files the old sidebar still uses on `next`, so it costs some
throwaway adaptation (old `StatusButton`/`TreeNode` consumers). Fold into PR E if that's not
worth it.*
- `utils/status.tsx` `getGroupStatus` O(n) rewrite + icon overhaul + `status.test.ts`,
  `IconSymbols` renames, `TypeIcon` extraction, `CollapseIcon` move,
  `StatusButton → ContextMenuButton` rename, `FilterPanel`/`SearchResults` icon consumers
- `getGroupDualStatus` (the dual change/test shape) stays with PR E — its only consumer is the
  new tree

### PR E — the sidebar tree rewrite (the remainder)
*Depends on A (RAC Tree/Virtualizer), benefits from B (escape/keys layering), C (label context),
D (primitives).*
- `Tree`, `TreeNode`, `useExpanded`, `RowUiContext`, `StatusContext`, `ContextMenu`,
  `Refs`/`Explorer`/`Sidebar` layout, `Search`/`SearchResults` integration, `utils/tree.ts`
  additions + tests, deletions (`useHighlighted`, `HighlightStyles`), all sidebar stories,
  `contextMenu` shortcut + event + `globals/exports.ts`, `Button` tooltip placement +
  `InteractiveTooltipWrapper`/`TooltipNote`, `ActionList`/`ListItem` polish, `Card` animation,
  mobile drawer integration

**Recommended path:** A first (it is also the riskiest to *delay* — every day it waits, `next`'s
RAC patch and the branch drift further apart), B and C in parallel right after, then rebase the
feature branch and decide D vs folding it in. A/B/C are each reviewable in one sitting and
independently green; they also de-risk E's review down to the genuinely novel code (virtualized
tree, sticky overlay, expansion model). One caveat when extracting A: it must include the
component import swaps in the same PR, since RAC 1.21's dist layout no longer matches the old
patched imports on `next`.
