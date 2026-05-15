# Story Rename Redirect — Design Spec

**Date:** 2026-04-22 (revised 2026-04-23)
**Branch:** `sidnioulz/story-rename-redirect`
**Status:** Approved for implementation planning

---

## Problem

Storybook monitors story files with HMR. When a story file is renamed, the index changes and all URLs for the old story IDs become 404s. Users currently viewing a renamed story are left on a broken URL with no guidance. This spec covers file renames and file deletions only (export-level renames are out of scope for this iteration).

---

## Goals

1. Detect file renames during HMR using server-side file watching
2. Track rename chains across a session to support redirecting from any historical story ID to its current location
3. Redirect the user to the renamed story automatically after re-indexing
4. Show a specialised "story was deleted" notice when the file was deleted rather than renamed
5. Fall back gracefully to existing 404 behaviour when rename data is unavailable or ambiguous

---

## Non-Goals

- Export-level (named export) renames — future iteration
- Persistence across page reloads — session-only
- Static build support — no server, no rename detection, no redirects
- Redirects for refs (composed Storybooks)

---

## Architecture Overview

Three independent building blocks:

```
SERVER
  watch-story-specifiers  →  rename detection (Watchpack pair + fingerprint disambiguation)
  StoryIndexGenerator     →  removed-file snapshot (exportName → storyId map)
  index-json              →  orchestration: emit invalidation, await re-index, write store

  RenameRedirectStore (UniversalStore LEADER)
        ↓ channel sync
MANAGER
  RenameRedirectStore (UniversalStore FOLLOWER)
  setIndex()  →  read store via getState()  →  selectStory() or specialised 404
```

Data flows in one direction: server detects and writes, manager reads. The manager never writes to the store.

---

## Building Block 1: Rename Detection

**File:** `code/core/src/core-server/utils/watch-story-specifiers.ts`

Watchpack already batches all file events within a 100ms window. A rename produces two events in the same batch: a removal (old path, `explanation='rename'`, no mtime) and an addition (new path, `explanation='rename'`, with mtime).

When a batch contains rename-explanation pairs, the server confirms which removal maps to which addition (relevant for folder renames with multiple files) using a single cross-platform method.

**Disambiguation — export-name fingerprint matching (cross-platform):**

`StoryIndexGenerator` maintains a snapshot of each removed file's export-name → story-ID map, captured just before the cache entry is deleted in `invalidate()`. This snapshot serves two purposes simultaneously: (1) a sorted export-name list acts as the fingerprint for matching removed files to added files, and (2) it provides the authoritative old story IDs for writing to the chain store — without re-reading the file (which no longer exists).

After re-indexing completes for the added files, their export-name → story-ID maps are read from the cache. A match between removed-file and added-file fingerprints (sorted export names) confirms the rename pair.

Zero extra I/O — all data comes from the indexer's own cache. The approach is identical on Unix and Windows.

**Fallback:** If disambiguation fails for a candidate pair (fingerprint mismatch, multiple matches, no match), log `logger.debug` and do nothing. No chain entry is written. The user sees the existing generic 404. A spurious redirect to the wrong story is worse than no redirect.

**Unambiguous deletions:** A `remove` event (or `change` with no mtime and `explanation !== 'rename'`) is a confirmed deletion — no disambiguation needed. These always produce a `[null]` deletion chain entry in the store. Only rename-explanation removals that fail disambiguation produce nothing.

**`onInvalidate` callback extended:**

```
(path, removed, renameHint?: { pairedWith: Path }) => void
```

Optional parameter — existing callers are unaffected.

---

## Building Block 2: Rename Chain Store

**New files:**

- `code/core/src/shared/rename-redirect-store/index.ts` — state shape, chain algorithm, store options
- `code/core/src/core-server/stores/rename-redirect.ts` — server leader instance
- `code/core/src/manager-api/stores/rename-redirect.ts` — manager follower instance

**State shape:**

```typescript
type RenameRedirectState = {
  chains: Record<StoryId, (StoryId | null)[]>;
};
// chain = []         should not exist in practice
// chain = [..., id]  redirect to last element
// chain = [..., null] story was deleted
```

**Chain algorithm (`applyRenameChains`):**

Pure function, independently testable. On each rename `oldId → newId`:

1. Extend all existing chains whose last element is `oldId` by appending `newId`
2. Add new entry `oldId: [newId]`
3. Drop any entry where last element equals source key (net no-op / round-trip rename — loop prevention)

On each deletion `deletedId`:

- Add or update entry `deletedId: [...existingChain, null]`

**Leader/follower pattern:**

- Server: always leader (matches status store pattern), except in Vitest subprocess
- Manager: leader only when `CONFIG_TYPE === 'PRODUCTION'` (static build — store is inert, always empty)
- Preview: not involved

**In static builds:** manager is leader with empty initial state. No renames are ever detected. Store is always `{ chains: {} }`. All redirect/deletion logic is skipped.

---

## Building Block 3: Orchestration

**File:** `code/core/src/core-server/utils/index-json.ts`

The commit order guarantee: the server writes rename data to the store **after** `STORY_INDEX_INVALIDATED` is emitted and **after** `getIndex()` resolves. This means:

1. `STORY_INDEX_INVALIDATED` emitted — manager starts `fetchIndex()` (HTTP round trip)
2. `getIndex()` awaited — new story IDs are now known
3. Pairs resolved by matching removed-file snapshots to newly indexed added files via export-name fingerprint
4. For each confirmed pair, old and new story IDs are aligned by **export name key** (not positional index) — robust against any reordering
5. `renameRedirectStore.setState(applyRenameChains(...))` — store updated
6. Manager's `fetchIndex()` completes — `setIndex()` runs — reads store via `getState()`

The HTTP round trip in step 1→6 is consistently slower than the in-process channel message in step 5. The store is virtually always ready before `setIndex()` runs. In the rare case it isn't, the manager falls through to the existing 404 behaviour (the chain target won't be in the new index yet).

**`StoryIndexGenerator` additions:**

- `removedFileSnapshots: Map<Path, Record<exportName, StoryId>>` — populated in `invalidate()` before cache deletion, keyed by export name for later alignment
- `getRemovedFileSnapshots()` / `clearRemovedFileSnapshots()` — accessors for `index-json.ts`

No `getLastIndex()` accessor is needed — all old-ID information lives in the removed-file snapshots.

---

## Building Block 4: Manager Redirect Logic

**File:** `code/core/src/manager-api/modules/stories.ts`

At the end of `setIndex()`, after the new index is applied to manager state:

1. If `currentStoryId` exists in new index → do nothing (story still there)
2. If not, read `renameRedirectStore.getState().chains[currentStoryId]`
3. `undefined` → no rename data, fall through to existing 404
4. Chain ending in `null` → known deletion, render specialised 404
5. Chain ending in a valid story ID present in new index → `api.selectStory(newId)`
6. Chain ending in a valid story ID **not** in new index → fall through to existing 404 (indexing lag)

**No subscriptions.** Store is read synchronously via `getState()` at the one moment both conditions are guaranteed: new index live, store updated. No race conditions possible.

**No new channel events.** `STORY_INDEX_INVALIDATED` is untouched — no payload changes, no breaking changes to public API.

---

## Building Block 5: Specialised 404 UI

**No new events. No new manager store fields.**

The existing missing-story rendering path in the manager is augmented to check the rename store when about to render a generic 404:

```typescript
const { chains } = renameRedirectStore.getState();
const chain = chains[currentStoryId];
const isKnownDeletion = chain !== undefined && chain[chain.length - 1] === null;
```

If `isKnownDeletion`: render _"This story was deleted."_ using existing error display patterns.
Otherwise: render existing generic missing-story UI, unchanged.

The deletion chain entry persists for the session. If a story with the same ID is later created, `setIndex()` finds it in the new index and skips all redirect/deletion logic — the existence check gates everything.

---

## Breaking Change Analysis

| Surface                                           | Change                                                                    | Breaking?           |
| ------------------------------------------------- | ------------------------------------------------------------------------- | ------------------- |
| `STORY_INDEX_INVALIDATED` event                   | No change to event name, payload, or emit timing                          | No                  |
| `onInvalidate` callback in `watchStorySpecifiers` | New optional 3rd parameter `renameHint?`                                  | No                  |
| `StoryIndexGenerator`                             | New public methods `getRemovedFileSnapshots`, `clearRemovedFileSnapshots` | No (additions only) |
| UniversalStore                                    | New store ID `storybook/rename-redirect`                                  | No                  |
| Manager store state                               | No new fields                                                             | No                  |
| Public channel events                             | No additions or changes                                                   | No                  |

---

## Testing Strategy

**Unit tests:**

- `applyRenameChains` — pure function, cover: single rename, chain extension, round-trip (loop prevention), deletion, rename-then-delete, folder rename (multiple pairs), explicit-title stable-ID case (chain collapses to no-op)
- Export-name fingerprint matching — mock cache entries with identical and differing export sets
- Export-name alignment — verify `oldIds[exportName]` maps to `newIds[exportName]` regardless of cache entry order

**Integration tests:**

- `watchStorySpecifiers` with mocked Watchpack — verify rename pairs produce `renameHint`, ambiguous batches produce nothing
- `StoryIndexGenerator.invalidate()` — verify removed-file snapshot captured before deletion, includes full exportName→storyId map
- `registerIndexJsonRoute` — verify store written after index resolves, not before

**E2E tests (existing sandbox flow):**

- Rename a story file → verify UI navigates to new story ID
- Rename a story file that uses an explicit `title` in meta → verify URL is unchanged (IDs are stable) and no navigation occurs
- Delete a story file → verify "story was deleted" notice appears
- Rename a folder with multiple story files → verify all stories redirect correctly
- Rename A→B→A → verify no redirect loop, user stays on A
