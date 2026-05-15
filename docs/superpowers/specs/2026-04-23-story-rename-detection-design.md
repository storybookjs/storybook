# Story Rename Detection — Design Spec

**Date:** 2026-04-23
**Branch:** `sidnioulz/story-rename-redirect` (builds on the prior file-rename work)
**Status:** Approved for implementation planning
**Supersedes deletion UX from:** [2026-04-22 Story Rename Redirect](./2026-04-22-story-rename-redirect-design.md)

---

## Problem

The prior spec handled file-level renames and deletions during HMR. Three common in-file edits were left unhandled:

1. **`meta.title` rename** — changes every story ID in the file while the exports stay identical.
2. **Component rename driving `autoTitle`** — same shape as (1); the indexer recomputes the title from the component identifier.
3. **Export rename** — `export const Foo` → `export const Bar`; from the index's perspective, one story ID disappears and another appears.

In all three, the old URL becomes a 404 even though the story is usually still reachable. Users hit a dead end even though enough information exists to redirect them — or, where we can't redirect safely, to point them at useful next steps.

## Goals

1. Auto-redirect when a rename can be inferred **unambiguously**.
2. Provide a helpful fallback UI for every other "story-missing" case: a list of stories currently in the same file plus a link to any component docs, so the user can recover without combing the sidebar.
3. Never produce a wrong redirect. When in doubt, show the fallback UI, not a silent navigation to the wrong story.
4. Compose cleanly with the existing file-rename work: same store, same manager integration, same conservative philosophy.

## Non-Goals

- Heuristic pairing of renamed exports (no 1+1 guessing, no name-similarity scoring, no content-based matching). Each removed export that can't be paired via unambiguous evidence becomes an orphan with a fallback UI, not a guess.
- Persistence across page reloads — still session-only.
- Static builds — no detection, no redirects, no overlay. Manager store stays inert.
- Refs (composed Storybooks) — no tracking, no overlay.

---

## Detection Design Principles

**Silence > wrong redirect.** The previous spec adopted this rule for ambiguous file renames and so does this one. A wrong redirect is a silent bug the user may not notice; a fallback overlay with options is a predictable UX the user can reason about.

**One signal, many cases.** Rather than classify in-file edits into discrete categories (title rename, component rename, export rename, deletion), the classifier asks a single question per export name: _was this symbol present before and after?_ Yes + different ID → rename. Yes + same ID → noop. No (gone) → orphan. This handles title/component/export/delete in one unified table.

**"Story was deleted" is a hint, not a terminal state.** Even when we can prove a story is gone (physical file deletion), we still offer followups. The UX always presents a way forward.

---

## Architecture Overview

```
SERVER
  StoryIndexGenerator.invalidate(path, removed=false)
    → snapshot cache entry BEFORE marking stale           (new: modifiedFileSnapshots)
  StoryIndexGenerator.invalidate(path, removed=true)
    → snapshot cache entry BEFORE deletion                (existing: removedFileSnapshots)

  index-json orchestration (once per debounce cycle, after getIndex()):
    1. Drain: renameCandidates, deletions, modifications
    2. Same-path conflict: deletion trumps modification
    3. Per-modification path: classifyFileChange(old, new) → { renames, orphans }
    4. Per-deletion path: snap → all IDs become deletion events with null-chain
    5. Unresolved file-rename candidates become orphans (origin = old path)
    6. Single store write via extendRenameMaps(prev, { renames, orphans, deletions })
    7. clearSnapshots()

MANAGER
  setIndex (unchanged): redirect via chains[id] if chain resolves in new index
  404 render path (refactored):
    origins[id] defined → FollowupOverlay
      { heading: "This story is no longer here"
                 or "This story was deleted" (when chains[id]?.last === null),
        siblings: stories currently at origins[id],
        docsEntry: optional docs at origins[id] }
    origins[id] undefined → existing generic 404
```

Two orthogonal data structures:

- **Snapshot maps** (on `StoryIndexGenerator`) — scratch input to the classifier, cleared per cycle.
- **`renameRedirectStore`** (`chains` + `origins`) — session-long memory, monotonically extended.

---

## Building Block 1: Classification algorithm

**File:** `code/core/src/shared/rename-redirect-store/classify.ts` (new pure function)

```typescript
type FileSnapshot = {
  stories: Record<ExportName, { id: StoryId }>;
  docs: { id: StoryId; name: StoryName }[];
};

type ClassifyResult = {
  renames: { oldId: StoryId; newId: StoryId }[];
  orphans: StoryId[];
};

function classifyFileChange(old: FileSnapshot, new_: FileSnapshot): ClassifyResult {
  const renames: { oldId: StoryId; newId: StoryId }[] = [];
  const orphans: StoryId[] = [];

  // Shared exports: same symbol before and after. If ID changed, only a
  // title or component rename can have caused that — a safe inference.
  for (const exportName of Object.keys(old.stories)) {
    if (exportName in new_.stories) {
      const oldId = old.stories[exportName].id;
      const newId = new_.stories[exportName].id;
      if (oldId !== newId) renames.push({ oldId, newId });
    } else {
      // Export gone from new → orphan. We do NOT try to pair it with an
      // added export. 1 added + 1 removed in the same save can be two
      // unrelated stories; a false-positive redirect is worse than a
      // followup UI.
      orphans.push(old.stories[exportName].id);
    }
  }

  // Added exports (keys(new_) \ keys(old)) intentionally ignored — they are
  // in the live index and the user can discover them via the sidebar.
  return { renames, orphans };
}
```

**Why this is enough:**

- **`meta.title` rename** — every shared export has a new ID. All renames. Zero orphans.
- **Component rename via autoTitle** — identical from the classifier's perspective; same result.
- **Export rename (`Primary → Default`)** — old export gone, new export added. `Primary` becomes an orphan; `Default` is ignored (not our concern — it's in the index). The 404 overlay lists `Default` as a sibling in the origin file.
- **Story deletion (export removed, no replacement)** — orphan, same UX.
- **Bulk refactor** — each removed export independently becomes an orphan.
- **Noop re-index** (save with no meaningful change) — no renames, no orphans.

**Invariant:** every old export name missing from the new snapshot contributes exactly one orphan or one rename, never both. Added exports are never surfaced.

---

## Building Block 2: Store state shape

**File:** `code/core/src/shared/rename-redirect-store/index.ts` (modified)

```typescript
type RenameRedirectState = {
  chains: Record<StoryId, (StoryId | null)[]>;
  origins: Record<StoryId, Path>;
};
```

- `chains`: redirect memory. Semantics unchanged from the prior spec. Tail `null` = confirmed physical deletion.
- `origins`: "what file did this old ID come from?" map. Written for every old ID observed this session — rename, orphan, or deletion. The 404 overlay reads this to find sibling stories and docs.

Both fields grow monotonically. Neither is cleared within a session.

---

## Building Block 3: `extendRenameMaps`

**File:** `code/core/src/shared/rename-redirect-store/index.ts` (renamed + generalised from `applyRenameChains`)

```typescript
type Rename = { oldId: StoryId; newId: StoryId; origin: Path };
type Orphan = { id: StoryId; origin: Path };
type Deletion = { id: StoryId; origin: Path };

function extendRenameMaps(
  state: RenameRedirectState,
  events: { renames: Rename[]; orphans: Orphan[]; deletions: Deletion[] },
): RenameRedirectState;
```

**Semantics:**

- **`chains`** — identical rules to the prior spec's `applyRenameChains`:
  - New rename extends all existing chains whose tail equals `oldId`.
  - New rename inserts/appends `chains[oldId] = [...existing, newId]`.
  - Round-trip sweep after each rename: drop any entry whose tail equals its own source key (prevents infinite loops on `A → B → A`).
  - Deletion appends `null` to all chains whose tail equals `deletion.id` and to the deletion source itself.
  - Orphans do **not** touch `chains`.
- **`origins`** — write-once:
  - For every event source ID (`rename.oldId`, `orphan.id`, `deletion.id`), set `origins[id] = origin` only if `origins[id]` is currently undefined.
  - First observation wins — matches the user's intuition that the "origin" file is the one they first lost a story from.

Existing `applyRenameChains` tests migrate to the new function name and assert on the `chains` subtree. New tests assert `origins` write-once behaviour and combined event batches.

---

## Building Block 4: `StoryIndexGenerator` snapshot capture

**File:** `code/core/src/core-server/utils/StoryIndexGenerator.ts` (modified)

- Add `modifiedFileSnapshots: Map<Path, FileSnapshot>` alongside existing `removedFileSnapshots`.
- In `invalidate(path, removed)`:
  - For both `removed=true` and `removed=false`, capture a `FileSnapshot` from the current `cacheEntry` **before** the cache mutation.
  - `removed=true` → snapshot into `removedFileSnapshots`; then `delete cache[absolutePath]`.
  - `removed=false` → snapshot into `modifiedFileSnapshots`; then `cache[absolutePath] = false`.
- Accessors: `getModifiedFileSnapshots()`, `clearSnapshots()` (drains both maps).
- `clearRemovedFileSnapshots()` is retained as a thin alias that calls `clearSnapshots()` — no downstream callers outside this repo, but no cost to keep.

Snapshot shape:

```typescript
type FileSnapshot = {
  stories: Record<ExportName, { id: StoryId }>;
  docs: { id: StoryId; name: StoryName }[];
};
```

Docs entries capture `name` because the 404 button surfaces the docs title.

---

## Building Block 5: Orchestration in `index-json.ts`

**File:** `code/core/src/core-server/utils/index-json.ts` (modified)

Add a third accumulator and extend the watchStorySpecifiers callback:

```typescript
const pendingRenameCandidates: { oldPath: Path; newPath: Path }[] = []; // existing
const pendingDeletions: Path[] = []; // existing
const pendingModifications: Path[] = []; // new

watchStorySpecifiers(normalizedStories, { workingDir }, async (path, removed, renameHint) => {
  (await storyIndexGeneratorPromise).invalidate(path, removed);
  if (removed) {
    if (renameHint) pendingRenameCandidates.push({ oldPath: path, newPath: renameHint.pairedWith });
    else pendingDeletions.push(path);
  } else {
    pendingModifications.push(path);
  }
  maybeInvalidate();
});
```

Inside the debounced `maybeInvalidate`, after `channel.emit(STORY_INDEX_INVALIDATED)` and `await generator.getIndex()`:

1. **Drain accumulators** via `splice(0)` into local arrays. Prevents double-processing if new events arrive mid-await.
2. **Same-path conflict resolution.** Remove any path from modifications that also appears in deletions or in a rename candidate's `oldPath`. Deletion beats modification.
3. **File-rename pairs (existing).** `resolveRenamePairs(...)` → `fileRenames` + `unresolved`. Each rename gets `origin = resolve(workingDir, oldPath)`.
4. **Modifications.**
   - For each path: read `modifiedFileSnapshots.get(absPath)` and reconstruct the new `FileSnapshot` from the current cache entry (same capture logic used at invalidate-time — iterate the cache entry's `entries` and partition into `stories` and `docs`).
   - Call `classifyFileChange(old, new)` → `{ renames, orphans }`.
   - Push each rename with `origin = absPath`; push each orphan `id` with `origin = absPath`.
5. **Confirmed file deletions.** For each path, read `removedFileSnapshots.get(absPath)` and produce one `Deletion` event per story ID (with the null-chain semantics already in `extendRenameMaps`).
6. **Unresolved file-rename candidates.** Treat as orphans with origin = the old absolute path.
7. **Single store write.** Call `renameRedirectStore.setState(prev => extendRenameMaps(prev, { renames, orphans, deletions }))`.
8. **Cleanup.** `generator.clearSnapshots()`.

**Error handling:**

- If `getIndex()` throws, `clearSnapshots()` runs in the catch branch and the function returns early — no partial store write.
- If the channel write fails (pathological store disconnect), the store simply doesn't update this cycle; future cycles are unaffected.

**`invalidateAll` path** (e.g., `preview.ts` change): no events populate the pending accumulators, so the orchestrator emits `STORY_INDEX_INVALIDATED` and returns before the classification pipeline — no false renames.

---

## Building Block 6: Manager redirect (unchanged)

**File:** `code/core/src/manager-api/modules/stories.ts`

No changes. The existing `setIndex` block reads `chains[storyId]` and calls `api.selectStory(last)` when the chain target exists in the new index. This covers:

- File renames (via `chains` written by the file-rename orchestrator, unchanged from prior spec)
- Title renames (via `chains` written by the classifier)
- Component renames (same mechanism)
- Orphans (no `chains` entry → falls through to the 404 path)

The `origins` field is not read here — it's for the 404 path only.

---

## Building Block 7: Followup 404 overlay

**File:** `code/core/src/manager/components/preview/Preview.tsx` (modifies the minimal deletion overlay from the prior spec)

**Trigger:** `storyId` is missing from the live index **and** `origins[storyId]` is defined.

**Component sketch:**

```typescript
type FollowupOverlayProps = {
  heading: 'This story is no longer here' | 'This story was deleted';
  siblings: API_StoryEntry[]; // current stories at origins[storyId]
  docsEntry?: API_DocsEntry; // current docs at origins[storyId] (if any)
  onSelect: (id: StoryId) => void;
};
```

**Rendering logic in the `canvasMapper` consumer:**

```typescript
const { chains, origins } = renameRedirectStore.getState();
const originPath = origins[storyId];

if (!originPath) {
  return null;  // fall through to existing generic 404
}

const siblings = Object.values(index?.entries ?? {}).filter(
  e => e.importPath === originPath && e.type === 'story'
);
const docsEntry = Object.values(index?.entries ?? {}).find(
  e => e.importPath === originPath && e.type === 'docs'
);

const chain = chains[storyId];
const heading: FollowupOverlayProps['heading'] =
  chain?.[chain.length - 1] === null
    ? 'This story was deleted'
    : 'This story is no longer here';

return <FollowupOverlay heading={heading} siblings={siblings} docsEntry={docsEntry} onSelect={api.selectStory} />;
```

**Rendering matrix:**

| Store state                           | UI                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `origins[id]` undefined               | Existing generic missing-story UI (no change from today)                         |
| `origins[id]` set, siblings non-empty | Full overlay: heading + sibling list + (optional) docs button + sidebar fallback |
| `origins[id]` set, siblings empty     | Overlay with heading + sidebar fallback only (file gone or empty)                |
| `chains[id].last === null`            | Heading switches to "This story was deleted"                                     |

**Props and data source:**

- `renameRedirectStore` already exported as `internal_renameRedirectStore` from `storybook/manager-api` (prior spec).
- Live index and `api.selectStory` already flow through the canvas consumer.
- No subscriptions. All reads synchronous during render.

**No channel events or additional manager state.** The overlay is a thin render-time derivation from the existing store + the live index.

---

## Breaking Change Analysis

| Surface                                           | Change                                                                                                                                   | Breaking? |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `STORY_INDEX_INVALIDATED`                         | Unchanged                                                                                                                                | No        |
| `onInvalidate` signature                          | Unchanged (3rd arg already optional)                                                                                                     | No        |
| `StoryIndexGenerator` public methods              | `removedFileSnapshots` accessors unchanged; `modifiedFileSnapshots`, `clearSnapshots` new; `clearRemovedFileSnapshots` retained as alias | No        |
| `applyRenameChains` → `extendRenameMaps`          | Internal function renamed + generalised; no public export                                                                                | No        |
| `RenameRedirectState`                             | Adds `origins` field. Session-scoped, no persistence migration needed                                                                    | No        |
| `UniversalStore` ID (`storybook/rename-redirect`) | Unchanged                                                                                                                                | No        |
| Manager public API                                | `internal_renameRedirectStore` export unchanged                                                                                          | No        |
| Channel events                                    | None added, none changed                                                                                                                 | No        |

Net: **no public breaking changes.** All work is additive or internal.

---

## Testing Strategy

### Unit tests

**`classifyFileChange`** (`shared/rename-redirect-store/classify.test.ts`, new):

- empty old, empty new → no events
- shared exports, all IDs unchanged → no events
- shared exports, all IDs changed (title/component rename) → all renames, no orphans
- partial rename (1 shared unchanged + 1 shared id-changed) → 1 rename
- single export removed (1, 0) → 1 orphan
- export rename as add+remove → 1 orphan (no 1+1 matching)
- bulk refactor (N removed, M added) → N orphans
- mixed (1 shared id-changed + 1 removed + 1 added) → 1 rename + 1 orphan

**`extendRenameMaps`** (extends prior `applyRenameChains.test.ts`):

- Prior tests migrate to new function name.
- Origin written for rename / orphan / deletion events.
- Origin write-once (second event for same ID leaves origin unchanged).
- Orphan-only event does not add to `chains`.
- Round-trip sweep on `chains` does not affect `origins`.

### Integration tests

**`StoryIndexGenerator`:**

- `invalidate(path, removed=false)` populates `modifiedFileSnapshots` before `cache[path] = false`.
- `invalidate(path, removed=true)` populates `removedFileSnapshots` (existing).
- `clearSnapshots()` empties both.

**`index-json.ts`:**

- `meta.title` rename at fixture level → `chains` entries written for each shared export whose ID changed.
- Export rename → `origins` entry for the old ID, no `chains` entry.
- Same-path conflict: path in both mods + deletes → deletion wins, no in-file classification.
- `getIndex()` throws → no partial writes, snapshots cleared.
- `invalidateAll` → no events flow through rename machinery.

**Manager `setIndex`:**

- Existing redirect tests stay green.
- New: setIndex does not redirect on an orphan (`chains[id]` undefined).

### Component / UI tests

**`FollowupOverlay`**:

- Heading switches on `isKnownDeletion` flag.
- Sibling list renders with navigate callbacks when non-empty.
- Docs button renders when `docsEntry` defined.
- Sibling section hidden when empty.

### E2E / sandbox tests

Manual or scripted via `yarn task e2e-tests-dev`:

1. `meta.title` rename → auto-redirect, URL updates.
2. `meta.component` rename (autoTitle) → auto-redirect.
3. Single export renamed → overlay on old URL, new story in sibling list.
4. Export deleted + unrelated export added in same save → overlay on deleted URL, no spurious redirect.
5. File deleted → overlay with deletion heading, empty siblings, sidebar fallback.
6. Bulk refactor → every removed export surfaces the overlay.
7. Round-trip (`Primary → Default → Primary`) → chain sweep drops intermediate, final URL resolves.

---

## Known Limitations

- **Agentic bulk refactors that move stories to a different file.** Origin is the old file; suggestions in the old file may be empty or unrelated. No silver bullet short of content-based matching, which we explicitly exclude.
- **Syntax error during save.** All stories in the broken file become orphans temporarily; when the syntax is fixed, re-index resurrects the IDs. If the user was on one of them, `setIndex`'s existence-check gate finds the story and the overlay never renders — but briefly, the overlay may flash.
- **Non-invalidate disappearances.** A story ID that disappears for reasons outside the watcher (e.g., tag-based filtering toggle) won't get an `origins` entry, so the UI falls through to the generic 404. Acceptable — the detector is a whitelist, not a fallback.
