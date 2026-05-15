# Story Rename Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect in-file rename events (`meta.title`, component rename driving autoTitle, individual export renames) during HMR; auto-redirect when evidence is unambiguous; show a helpful fallback 404 overlay listing sibling stories and an optional docs link for every other case.

**Architecture:** New pure function `classifyFileChange` compares a pre-modification `FileSnapshot` to the post-re-index state and emits `renames` + `orphans`. Snapshots live on `StoryIndexGenerator.modifiedFileSnapshots`, captured at `invalidate()` time. The orchestrator in `index-json.ts` drains snapshots once `getIndex()` resolves, feeds the classifier, and writes events into `renameRedirectStore` via the new `extendRenameMaps` function (generalisation of `applyRenameChains`). Store gains an `origins` map so the manager-side 404 can show a followup UI with sibling stories and a docs button.

**Tech Stack:** TypeScript, Vitest, Storybook UniversalStore, Watchpack, React (manager UI).

**Spec:** [docs/superpowers/specs/2026-04-23-story-rename-detection-design.md](../specs/2026-04-23-story-rename-detection-design.md)

---

## File Structure

**New files:**

- `code/core/src/shared/rename-redirect-store/classify.ts` — `classifyFileChange` pure function + `FileSnapshot` type
- `code/core/src/shared/rename-redirect-store/classify.test.ts` — unit tests for the classifier
- `code/core/src/manager/components/preview/FollowupOverlay.tsx` — the replacement 404 overlay
- `code/core/src/manager/components/preview/FollowupOverlay.test.tsx` — component tests

**Modified files:**

- `code/core/src/shared/rename-redirect-store/index.ts` — add `origins` field, rename `applyRenameChains` → `extendRenameMaps` with grouped event shape, origin write-once behaviour
- `code/core/src/shared/rename-redirect-store/index.test.ts` — migrate existing tests, add origin-write tests
- `code/core/src/core-server/utils/StoryIndexGenerator.ts` — retype `removedFileSnapshots` to `FileSnapshot`, add `modifiedFileSnapshots`, `clearSnapshots`, preserve `clearRemovedFileSnapshots` alias
- `code/core/src/core-server/utils/StoryIndexGenerator.test.ts` — extend removed-snapshot tests; add modified-snapshot tests
- `code/core/src/core-server/utils/index-json.ts` — new `pendingModifications` accumulator, classify modifications, same-path conflict resolution, route orphans, call `extendRenameMaps`
- `code/core/src/core-server/utils/index-json.test.ts` — extend orchestration tests
- `code/core/src/manager/components/preview/Preview.tsx` — replace `DeletionOverlay` + `isKnownDeletion` mapper with `FollowupOverlay` wired to `origins`

---

## Task 1: FileSnapshot type and classifyFileChange skeleton

**Files:**

- Create: `code/core/src/shared/rename-redirect-store/classify.ts`
- Create: `code/core/src/shared/rename-redirect-store/classify.test.ts`

- [ ] **Step 1: Write a failing test for an empty classifier call**

```typescript
// code/core/src/shared/rename-redirect-store/classify.test.ts
import { describe, expect, it } from 'vitest';

import { classifyFileChange, type FileSnapshot } from './classify.ts';

const empty: FileSnapshot = { stories: {}, docs: [] };

describe('classifyFileChange', () => {
  it('returns no events when both snapshots are empty', () => {
    expect(classifyFileChange(empty, empty)).toEqual({ renames: [], orphans: [] });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `yarn test run code/core/src/shared/rename-redirect-store/classify.test.ts`
Expected: FAIL with "classifyFileChange is not a function" or module-not-found.

- [ ] **Step 3: Create the classifier module with the minimal skeleton**

```typescript
// code/core/src/shared/rename-redirect-store/classify.ts
import type { StoryId, StoryName } from '../../types/index.ts';

export type ExportName = string;

export type FileSnapshot = {
  stories: Record<ExportName, { id: StoryId }>;
  docs: { id: StoryId; name: StoryName }[];
};

export type ClassifyResult = {
  renames: { oldId: StoryId; newId: StoryId }[];
  orphans: StoryId[];
};

export function classifyFileChange(_old: FileSnapshot, _new: FileSnapshot): ClassifyResult {
  return { renames: [], orphans: [] };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `yarn test run code/core/src/shared/rename-redirect-store/classify.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/classify.ts code/core/src/shared/rename-redirect-store/classify.test.ts
git commit -m "feat(rename-detect): classifyFileChange skeleton + empty-input test"
```

---

## Task 2: classifyFileChange — shared exports, IDs unchanged

**Files:**

- Modify: `code/core/src/shared/rename-redirect-store/classify.test.ts`

- [ ] **Step 1: Add the failing test**

Append to the `describe` block:

```typescript
it('returns no events when shared exports keep the same IDs', () => {
  const snapshot: FileSnapshot = {
    stories: { Primary: { id: 'button--primary' } },
    docs: [],
  };
  expect(classifyFileChange(snapshot, snapshot)).toEqual({ renames: [], orphans: [] });
});
```

- [ ] **Step 2: Run the test**

Run: `yarn test run code/core/src/shared/rename-redirect-store/classify.test.ts`
Expected: PASS — the skeleton already returns no events.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/classify.test.ts
git commit -m "test(rename-detect): cover shared-exports-unchanged case"
```

---

## Task 3: classifyFileChange — shared exports, IDs changed (title/component rename)

**Files:**

- Modify: `code/core/src/shared/rename-redirect-store/classify.test.ts`
- Modify: `code/core/src/shared/rename-redirect-store/classify.ts`

- [ ] **Step 1: Add the failing test**

Append to the `describe` block:

```typescript
it('emits renames for shared exports whose IDs changed (title rename)', () => {
  const old: FileSnapshot = {
    stories: {
      Primary: { id: 'old--primary' },
      Secondary: { id: 'old--secondary' },
    },
    docs: [],
  };
  const next: FileSnapshot = {
    stories: {
      Primary: { id: 'new--primary' },
      Secondary: { id: 'new--secondary' },
    },
    docs: [],
  };
  expect(classifyFileChange(old, next)).toEqual({
    renames: [
      { oldId: 'old--primary', newId: 'new--primary' },
      { oldId: 'old--secondary', newId: 'new--secondary' },
    ],
    orphans: [],
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `yarn test run code/core/src/shared/rename-redirect-store/classify.test.ts`
Expected: FAIL — skeleton emits no renames.

- [ ] **Step 3: Implement the shared-export branch**

Replace the body of `classifyFileChange`:

```typescript
export function classifyFileChange(old: FileSnapshot, next: FileSnapshot): ClassifyResult {
  const renames: { oldId: StoryId; newId: StoryId }[] = [];
  const orphans: StoryId[] = [];

  for (const exportName of Object.keys(old.stories)) {
    const before = old.stories[exportName];
    const after = next.stories[exportName];
    if (after) {
      if (before.id !== after.id) {
        renames.push({ oldId: before.id, newId: after.id });
      }
    }
  }

  return { renames, orphans };
}
```

- [ ] **Step 4: Run tests to confirm all pass**

Run: `yarn test run code/core/src/shared/rename-redirect-store/classify.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/
git commit -m "feat(rename-detect): classify shared-export ID change as rename"
```

---

## Task 4: classifyFileChange — removed exports become orphans

**Files:**

- Modify: `code/core/src/shared/rename-redirect-store/classify.test.ts`
- Modify: `code/core/src/shared/rename-redirect-store/classify.ts`

- [ ] **Step 1: Add the failing test**

Append to the `describe` block:

```typescript
it('emits an orphan for each removed export', () => {
  const old: FileSnapshot = {
    stories: {
      Primary: { id: 'button--primary' },
      Secondary: { id: 'button--secondary' },
    },
    docs: [],
  };
  const next: FileSnapshot = {
    stories: { Secondary: { id: 'button--secondary' } },
    docs: [],
  };
  expect(classifyFileChange(old, next)).toEqual({
    renames: [],
    orphans: ['button--primary'],
  });
});
```

- [ ] **Step 2: Run the test**

Run: `yarn test run code/core/src/shared/rename-redirect-store/classify.test.ts`
Expected: FAIL — `orphans` empty, test expected `['button--primary']`.

- [ ] **Step 3: Extend the classifier to record orphans**

Update the shared-export loop:

```typescript
for (const exportName of Object.keys(old.stories)) {
  const before = old.stories[exportName];
  const after = next.stories[exportName];
  if (after) {
    if (before.id !== after.id) {
      renames.push({ oldId: before.id, newId: after.id });
    }
  } else {
    orphans.push(before.id);
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `yarn test run code/core/src/shared/rename-redirect-store/classify.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/
git commit -m "feat(rename-detect): removed exports become orphans"
```

---

## Task 5: classifyFileChange — mixed shared-changed + orphan

**Files:**

- Modify: `code/core/src/shared/rename-redirect-store/classify.test.ts`

- [ ] **Step 1: Add the test**

Append to the `describe` block:

```typescript
it('handles a mix of shared ID change, orphan, and ignored new export', () => {
  const old: FileSnapshot = {
    stories: {
      Primary: { id: 'old--primary' },
      Secondary: { id: 'old--secondary' },
    },
    docs: [],
  };
  const next: FileSnapshot = {
    stories: {
      Primary: { id: 'new--primary' }, // shared + id-changed → rename
      Tertiary: { id: 'new--tertiary' }, // added → ignored
    },
    docs: [],
  };
  expect(classifyFileChange(old, next)).toEqual({
    renames: [{ oldId: 'old--primary', newId: 'new--primary' }],
    orphans: ['old--secondary'],
  });
});
```

- [ ] **Step 2: Run the test to confirm it passes**

Run: `yarn test run code/core/src/shared/rename-redirect-store/classify.test.ts`
Expected: PASS — existing implementation already handles this.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/classify.test.ts
git commit -m "test(rename-detect): cover mixed change classification"
```

---

## Task 6: classifyFileChange — added exports never become orphans

**Files:**

- Modify: `code/core/src/shared/rename-redirect-store/classify.test.ts`

- [ ] **Step 1: Add the test**

Append to the `describe` block:

```typescript
it('ignores exports added in the new snapshot', () => {
  const old: FileSnapshot = { stories: {}, docs: [] };
  const next: FileSnapshot = {
    stories: { Primary: { id: 'button--primary' } },
    docs: [],
  };
  expect(classifyFileChange(old, next)).toEqual({ renames: [], orphans: [] });
});
```

- [ ] **Step 2: Run the test**

Run: `yarn test run code/core/src/shared/rename-redirect-store/classify.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/classify.test.ts
git commit -m "test(rename-detect): added exports are ignored"
```

---

## Task 7: Add `origins` field to RenameRedirectState

**Files:**

- Modify: `code/core/src/shared/rename-redirect-store/index.ts`

- [ ] **Step 1: Extend the type and initial state**

Replace the state type and initial state block in `index.ts`:

```typescript
import type { Path, StoryId } from '../../types/index.ts';

export type RenameRedirectChain = (StoryId | null)[];

export type RenameRedirectState = {
  chains: Record<StoryId, RenameRedirectChain>;
  origins: Record<StoryId, Path>;
};

export const INITIAL_RENAME_REDIRECT_STATE: RenameRedirectState = {
  chains: {},
  origins: {},
};
```

- [ ] **Step 2: Run existing tests to confirm nothing broke**

Run: `yarn test run code/core/src/shared/rename-redirect-store/index.test.ts`
Expected: PASS — existing tests don't reference `origins`.

- [ ] **Step 3: Run the orchestration and manager tests that consume the store**

Run: `yarn test run code/core/src/core-server/utils/index-json.test.ts code/core/src/manager-api/tests/stories.test.ts`
Expected: PASS — existing code reads only `chains`, still works.

- [ ] **Step 4: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/index.ts
git commit -m "feat(rename-detect): add origins field to RenameRedirectState"
```

---

## Task 8: Rename `applyRenameChains` → `extendRenameMaps` and switch to grouped event shape

**Files:**

- Modify: `code/core/src/shared/rename-redirect-store/index.ts`
- Modify: `code/core/src/shared/rename-redirect-store/index.test.ts`
- Modify: `code/core/src/core-server/utils/index-json.ts`
- Modify: `code/core/src/core-server/utils/index-json.test.ts`

- [ ] **Step 1: Introduce the new types and stub function, keeping old behaviour**

In `index.ts`, replace the `Rename` type and `applyRenameChains` export with:

```typescript
export type Rename = { oldId: StoryId; newId: StoryId; origin: Path };
export type Orphan = { id: StoryId; origin: Path };
export type Deletion = { id: StoryId; origin: Path };

export type RenameEvents = {
  renames: Rename[];
  orphans: Orphan[];
  deletions: Deletion[];
};

export function extendRenameMaps(
  current: RenameRedirectState,
  events: RenameEvents,
): RenameRedirectState {
  const chains = { ...current.chains };
  const origins = { ...current.origins };

  for (const { oldId, newId } of events.renames) {
    for (const source of Object.keys(chains)) {
      const chain = chains[source];
      if (chain.length > 0 && chain[chain.length - 1] === oldId) {
        chains[source] = [...chain, newId];
      }
    }
    chains[oldId] = [...(chains[oldId] ?? []), newId];
    for (const source of Object.keys(chains)) {
      const chain = chains[source];
      if (chain.length > 0 && chain[chain.length - 1] === source) {
        delete chains[source];
      }
    }
  }

  for (const { id: deletedId } of events.deletions) {
    for (const source of Object.keys(chains)) {
      const chain = chains[source];
      if (chain.length > 0 && chain[chain.length - 1] === deletedId) {
        chains[source] = [...chain, null];
      }
    }
    chains[deletedId] = [...(chains[deletedId] ?? []), null];
  }

  return { chains, origins };
}
```

Delete the old `applyRenameChains` export. Origin writes come in subsequent tasks — this commit only changes the signature and preserves existing chain behaviour.

- [ ] **Step 2: Migrate the existing test file**

In `index.test.ts`:

- Replace all imports of `applyRenameChains` with `extendRenameMaps`.
- Update every call site to pass the grouped shape:

```typescript
// Before
applyRenameChains(state, [{ oldId: 'a', newId: 'b' }], []);
// After
extendRenameMaps(state, {
  renames: [{ oldId: 'a', newId: 'b', origin: './src/Foo.stories.ts' }],
  orphans: [],
  deletions: [],
});
```

Use a placeholder origin string (e.g. `'./src/Foo.stories.ts'`) in every migrated test. The chain-only tests don't assert on origins; that's covered by a later task.

- Also update the deletion tests similarly:

```typescript
extendRenameMaps(state, {
  renames: [],
  orphans: [],
  deletions: [{ id: 'gone--story', origin: './src/Gone.stories.ts' }],
});
```

- [ ] **Step 3: Update the `index-json.ts` caller**

In `index-json.ts`, replace the single call to `applyRenameChains` with:

```typescript
import { extendRenameMaps } from '../../shared/rename-redirect-store/index.ts';
// ...
renameRedirectStore.setState((prev) =>
  extendRenameMaps(prev, {
    renames: renames.map((r) => ({ ...r, origin: resolve(workingDir, /* origin path */ '') })),
    orphans: [],
    deletions: deletedIds.map((id) => ({ id, origin: /* origin path from snapshot */ '' })),
  }),
);
```

The full origin threading lands in Task 18 — for now, pass an empty string `''` so the code compiles. The tests written in the next commits will force proper origin wiring.

- [ ] **Step 4: Update `index-json.test.ts` to compile**

Any test that asserts on the store shape after `setState` should now accept `origins` being present (initial `{}`). Verify tests still pass; they mostly assert on `chains`.

- [ ] **Step 5: Run all affected tests to confirm still green**

Run: `yarn test run code/core/src/shared/rename-redirect-store/index.test.ts code/core/src/core-server/utils/index-json.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/ code/core/src/core-server/utils/index-json.ts code/core/src/core-server/utils/index-json.test.ts
git commit -m "refactor(rename-detect): rename applyRenameChains to extendRenameMaps with grouped event shape"
```

---

## Task 9: extendRenameMaps writes origins for renames (TDD)

**Files:**

- Modify: `code/core/src/shared/rename-redirect-store/index.test.ts`
- Modify: `code/core/src/shared/rename-redirect-store/index.ts`

- [ ] **Step 1: Add the failing test**

```typescript
it('writes origin for a rename event', () => {
  const result = extendRenameMaps(INITIAL_RENAME_REDIRECT_STATE, {
    renames: [{ oldId: 'a--x', newId: 'b--x', origin: './src/A.stories.ts' }],
    orphans: [],
    deletions: [],
  });
  expect(result.origins).toEqual({ 'a--x': './src/A.stories.ts' });
});
```

- [ ] **Step 2: Run the test**

Run: `yarn test run code/core/src/shared/rename-redirect-store/index.test.ts`
Expected: FAIL — `origins` empty.

- [ ] **Step 3: Extend the implementation**

After the renames loop, add:

```typescript
for (const { oldId, origin } of events.renames) {
  if (!(oldId in origins)) {
    origins[oldId] = origin;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `yarn test run code/core/src/shared/rename-redirect-store/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/
git commit -m "feat(rename-detect): extendRenameMaps writes origin for renames"
```

---

## Task 10: extendRenameMaps writes origins for orphans

**Files:**

- Modify: `code/core/src/shared/rename-redirect-store/index.test.ts`
- Modify: `code/core/src/shared/rename-redirect-store/index.ts`

- [ ] **Step 1: Add the failing test**

```typescript
it('writes origin for an orphan without touching chains', () => {
  const result = extendRenameMaps(INITIAL_RENAME_REDIRECT_STATE, {
    renames: [],
    orphans: [{ id: 'orphan--x', origin: './src/Orphan.stories.ts' }],
    deletions: [],
  });
  expect(result.origins).toEqual({ 'orphan--x': './src/Orphan.stories.ts' });
  expect(result.chains).toEqual({});
});
```

- [ ] **Step 2: Run the test**

Run: `yarn test run code/core/src/shared/rename-redirect-store/index.test.ts`
Expected: FAIL — orphan branch not implemented.

- [ ] **Step 3: Add the orphan branch**

Inside `extendRenameMaps`, after the rename loop and before deletions:

```typescript
for (const { id, origin } of events.orphans) {
  if (!(id in origins)) {
    origins[id] = origin;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `yarn test run code/core/src/shared/rename-redirect-store/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/
git commit -m "feat(rename-detect): extendRenameMaps writes origin for orphans"
```

---

## Task 11: extendRenameMaps writes origins for deletions

**Files:**

- Modify: `code/core/src/shared/rename-redirect-store/index.test.ts`
- Modify: `code/core/src/shared/rename-redirect-store/index.ts`

- [ ] **Step 1: Add the failing test**

```typescript
it('writes origin for a deletion alongside the null chain', () => {
  const result = extendRenameMaps(INITIAL_RENAME_REDIRECT_STATE, {
    renames: [],
    orphans: [],
    deletions: [{ id: 'gone--story', origin: './src/Gone.stories.ts' }],
  });
  expect(result.origins).toEqual({ 'gone--story': './src/Gone.stories.ts' });
  expect(result.chains).toEqual({ 'gone--story': [null] });
});
```

- [ ] **Step 2: Run the test**

Run: `yarn test run code/core/src/shared/rename-redirect-store/index.test.ts`
Expected: FAIL — deletion branch writes chain but not origin.

- [ ] **Step 3: Add deletion-origin branch**

After the existing deletion chain loop:

```typescript
for (const { id, origin } of events.deletions) {
  if (!(id in origins)) {
    origins[id] = origin;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `yarn test run code/core/src/shared/rename-redirect-store/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/
git commit -m "feat(rename-detect): extendRenameMaps writes origin for deletions"
```

---

## Task 12: extendRenameMaps — origin write-once semantics

**Files:**

- Modify: `code/core/src/shared/rename-redirect-store/index.test.ts`

- [ ] **Step 1: Add the test**

```typescript
it('never overwrites an existing origin (first-wins semantics)', () => {
  const step1 = extendRenameMaps(INITIAL_RENAME_REDIRECT_STATE, {
    renames: [{ oldId: 'a--x', newId: 'b--x', origin: './first.ts' }],
    orphans: [],
    deletions: [],
  });
  const step2 = extendRenameMaps(step1, {
    renames: [{ oldId: 'a--x', newId: 'c--x', origin: './second.ts' }],
    orphans: [],
    deletions: [],
  });
  expect(step2.origins['a--x']).toBe('./first.ts');
});
```

- [ ] **Step 2: Run the test**

Run: `yarn test run code/core/src/shared/rename-redirect-store/index.test.ts`
Expected: PASS — the guard `if (!(oldId in origins))` added in Task 9 already enforces this.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/index.test.ts
git commit -m "test(rename-detect): origin write-once semantics"
```

---

## Task 13: Retype FileSnapshot on StoryIndexGenerator (incl. docs)

**Files:**

- Modify: `code/core/src/core-server/utils/StoryIndexGenerator.ts`
- Modify: `code/core/src/core-server/utils/StoryIndexGenerator.test.ts`

- [ ] **Step 1: Import the shared `FileSnapshot` type**

In `StoryIndexGenerator.ts`, replace the existing `removedFileSnapshots: Map<Path, Record<string, StoryId>>` with the new shape:

```typescript
import type { FileSnapshot } from '../../shared/rename-redirect-store/classify.ts';

// inside the class:
private removedFileSnapshots: Map<Path, FileSnapshot> = new Map();
```

Update `getRemovedFileSnapshots()` return type accordingly:

```typescript
getRemovedFileSnapshots(): Map<Path, FileSnapshot> {
  return this.removedFileSnapshots;
}
```

- [ ] **Step 2: Update the snapshot-capture block in `invalidate()`**

Replace the snapshot block inside `invalidate(path, removed=true)`:

```typescript
if (cacheEntry && cacheEntry.type === 'stories') {
  const stories: FileSnapshot['stories'] = {};
  const docs: FileSnapshot['docs'] = [];
  for (const entry of cacheEntry.entries) {
    if (entry.type === 'story' && 'exportName' in entry && entry.exportName) {
      stories[entry.exportName] = { id: entry.id };
    } else if (entry.type === 'docs') {
      docs.push({ id: entry.id, name: entry.name });
    }
  }
  if (Object.keys(stories).length > 0 || docs.length > 0) {
    this.removedFileSnapshots.set(absolutePath, { stories, docs });
  }
}
```

- [ ] **Step 3: Update the existing snapshot tests to match the new shape**

In `StoryIndexGenerator.test.ts`, change expectations for `getRemovedFileSnapshots()`:

```typescript
// Before
expect(snapshot).toEqual({ StoryOne: 'b--story-one' });
// After
expect(snapshot).toEqual({ stories: { StoryOne: { id: 'b--story-one' } }, docs: [] });
```

- [ ] **Step 4: Update the `resolveRenamePairs` consumer in `index-json.ts`**

`resolveRenamePairs` currently calls `Object.values(oldSnap)` to get old IDs. Update to `Object.values(oldSnap.stories).map((s) => s.id)` — or more directly, adjust the algorithm to use `oldSnap.stories` and `newSnap.stories`:

```typescript
// Locate the resolveRenamePairs function in index-json.ts and update it to work
// with FileSnapshot.stories for fingerprinting + id extraction:

for (const { oldPath, newPath } of candidates) {
  const absOld = resolve(workingDir, oldPath);
  const oldSnap = removedSnapshots.get(absOld);
  const newSnap = newExportsByPath.get(newPath);
  if (!oldSnap || !newSnap || fingerprintOf(oldSnap.stories) !== fingerprintOf(newSnap)) {
    unresolved.push(oldPath);
    continue;
  }
  for (const exportName of Object.keys(oldSnap.stories)) {
    const oldId = oldSnap.stories[exportName].id;
    const newId = newSnap[exportName];
    if (oldId && newId) {
      renames.push({ oldId, newId });
    }
  }
}

// Where fingerprintOf now accepts either FileSnapshot['stories'] or
// Record<exportName, StoryId>. Keep it as a single function by normalising:
function fingerprintOf<T>(map: Record<string, T>): string {
  return Object.keys(map).sort().join(',');
}
```

Update the deletion-path code similarly:

```typescript
for (const deletedPath of deletions) {
  const absDeleted = resolve(workingDir, deletedPath);
  const snap = removedSnapshots.get(absDeleted);
  if (snap) {
    for (const { id } of Object.values(snap.stories)) {
      deletedIds.push(id);
    }
  }
}
```

- [ ] **Step 5: Run all affected tests**

Run: `yarn test run code/core/src/core-server/utils/StoryIndexGenerator.test.ts code/core/src/core-server/utils/index-json.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add code/core/src/core-server/utils/StoryIndexGenerator.ts code/core/src/core-server/utils/StoryIndexGenerator.test.ts code/core/src/core-server/utils/index-json.ts
git commit -m "refactor(rename-detect): use FileSnapshot shape for removed-file snapshots"
```

---

## Task 14: Add modifiedFileSnapshots map + snapshot capture on modify

**Files:**

- Modify: `code/core/src/core-server/utils/StoryIndexGenerator.ts`
- Modify: `code/core/src/core-server/utils/StoryIndexGenerator.test.ts`

- [ ] **Step 1: Add the failing test**

In `StoryIndexGenerator.test.ts`, inside the existing `removed file snapshots` describe (or a new adjacent one `modified file snapshots`):

```typescript
describe('modified file snapshots', () => {
  it('captures stories+docs before marking the cache entry stale (invalidate with removed=false)', async () => {
    const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
      './src/**/*.stories.(ts|js|mjs|jsx)',
      options,
    );
    const generator = new StoryIndexGenerator([specifier], options);
    await generator.initialize();
    await generator.getIndex();

    generator.invalidate('./src/B.stories.ts', false);

    const snapshots = generator.getModifiedFileSnapshots();
    const absolutePath = join(options.workingDir, 'src/B.stories.ts');
    const snapshot = snapshots.get(absolutePath);
    expect(snapshot).toBeDefined();
    expect(snapshot!.stories).toEqual({ StoryOne: { id: 'b--story-one' } });
  });
});
```

- [ ] **Step 2: Run the test**

Run: `yarn test run code/core/src/core-server/utils/StoryIndexGenerator.test.ts -t "modified file snapshots"`
Expected: FAIL — `getModifiedFileSnapshots` does not exist.

- [ ] **Step 3: Add the new map, accessor, and capture branch**

In `StoryIndexGenerator.ts`:

```typescript
private modifiedFileSnapshots: Map<Path, FileSnapshot> = new Map();

getModifiedFileSnapshots(): Map<Path, FileSnapshot> {
  return this.modifiedFileSnapshots;
}
```

Then, in `invalidate()`, add a mirror branch for the `removed=false` path. Extract the capture logic into a shared helper:

```typescript
private captureSnapshot(cacheEntry: StoriesCacheEntry): FileSnapshot | undefined {
  const stories: FileSnapshot['stories'] = {};
  const docs: FileSnapshot['docs'] = [];
  for (const entry of cacheEntry.entries) {
    if (entry.type === 'story' && 'exportName' in entry && entry.exportName) {
      stories[entry.exportName] = { id: entry.id };
    } else if (entry.type === 'docs') {
      docs.push({ id: entry.id, name: entry.name });
    }
  }
  return Object.keys(stories).length > 0 || docs.length > 0
    ? { stories, docs }
    : undefined;
}
```

Inside `invalidate()`, call `captureSnapshot` for both branches:

```typescript
if (cacheEntry && cacheEntry.type === 'stories') {
  const snap = this.captureSnapshot(cacheEntry);
  if (snap) {
    if (removed) this.removedFileSnapshots.set(absolutePath, snap);
    else this.modifiedFileSnapshots.set(absolutePath, snap);
  }
}
```

(Place this BEFORE the existing `if (removed) { ... delete cache[absolutePath]; } else { cache[absolutePath] = false; }` block.)

- [ ] **Step 4: Run tests**

Run: `yarn test run code/core/src/core-server/utils/StoryIndexGenerator.test.ts`
Expected: PASS (all snapshot tests).

- [ ] **Step 5: Commit**

```bash
git add code/core/src/core-server/utils/StoryIndexGenerator.ts code/core/src/core-server/utils/StoryIndexGenerator.test.ts
git commit -m "feat(rename-detect): capture modifiedFileSnapshots in invalidate"
```

---

## Task 15: clearSnapshots drains both maps + preserve alias

**Files:**

- Modify: `code/core/src/core-server/utils/StoryIndexGenerator.ts`
- Modify: `code/core/src/core-server/utils/StoryIndexGenerator.test.ts`

- [ ] **Step 1: Add the failing test**

```typescript
it('clearSnapshots() empties both modified and removed maps', async () => {
  const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
    './src/**/*.stories.(ts|js|mjs|jsx)',
    options,
  );
  const generator = new StoryIndexGenerator([specifier], options);
  await generator.initialize();
  await generator.getIndex();

  generator.invalidate('./src/A.stories.js', false); // populates modified
  generator.invalidate('./src/B.stories.ts', true); // populates removed
  expect(generator.getModifiedFileSnapshots().size).toBeGreaterThan(0);
  expect(generator.getRemovedFileSnapshots().size).toBeGreaterThan(0);

  generator.clearSnapshots();
  expect(generator.getModifiedFileSnapshots().size).toBe(0);
  expect(generator.getRemovedFileSnapshots().size).toBe(0);
});
```

- [ ] **Step 2: Run the test**

Run: `yarn test run code/core/src/core-server/utils/StoryIndexGenerator.test.ts -t "clearSnapshots"`
Expected: FAIL — `clearSnapshots` does not exist.

- [ ] **Step 3: Implement `clearSnapshots` and the alias**

In `StoryIndexGenerator.ts`:

```typescript
clearSnapshots(): void {
  this.modifiedFileSnapshots.clear();
  this.removedFileSnapshots.clear();
}

// Kept for backward-compatibility with callers that predate the generalisation.
clearRemovedFileSnapshots(): void {
  this.clearSnapshots();
}
```

- [ ] **Step 4: Run tests**

Run: `yarn test run code/core/src/core-server/utils/StoryIndexGenerator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/core-server/utils/StoryIndexGenerator.ts code/core/src/core-server/utils/StoryIndexGenerator.test.ts
git commit -m "feat(rename-detect): clearSnapshots drains both maps"
```

---

## Task 16: Pending modifications accumulator in index-json

**Files:**

- Modify: `code/core/src/core-server/utils/index-json.ts`

- [ ] **Step 1: Add the new accumulator next to the existing ones**

In `registerIndexJsonRoute`, near the top where `pendingRenameCandidates` and `pendingDeletions` are declared:

```typescript
const pendingRenameCandidates: RenameCandidate[] = [];
const pendingDeletions: Path[] = [];
const pendingModifications: Path[] = []; // new
```

- [ ] **Step 2: Route modification events into the accumulator**

Update the `watchStorySpecifiers` callback:

```typescript
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

- [ ] **Step 3: Compile to confirm no type errors**

Run: `cd code && yarn tsc --noEmit -p core/tsconfig.json`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add code/core/src/core-server/utils/index-json.ts
git commit -m "feat(rename-detect): pending modifications accumulator"
```

---

## Task 17: Orchestrator classifies modifications and routes orphans

**Files:**

- Modify: `code/core/src/core-server/utils/index-json.ts`

- [ ] **Step 1: Update the debounced `maybeInvalidate` body**

Replace the body to drain all three accumulators, resolve same-path conflicts, classify modifications, and emit a single `extendRenameMaps` call.

```typescript
import {
  classifyFileChange,
  type FileSnapshot,
} from '../../shared/rename-redirect-store/classify.ts';
import {
  extendRenameMaps,
  type Rename,
  type Orphan,
  type Deletion,
} from '../../shared/rename-redirect-store/index.ts';

// ...

const maybeInvalidate = debounce(
  async () => {
    channel.emit(STORY_INDEX_INVALIDATED);
    onStoryIndexInvalidated?.();

    const renameCandidates = pendingRenameCandidates.splice(0);
    const deletions = pendingDeletions.splice(0);
    let modifications = pendingModifications.splice(0);

    if (renameCandidates.length === 0 && deletions.length === 0 && modifications.length === 0) {
      return;
    }

    // Same-path conflict: deletion (and rename-source) trump modification
    const deletionPaths = new Set(deletions);
    const renameSourcePaths = new Set(renameCandidates.map((r) => r.oldPath));
    modifications = modifications.filter((p) => !deletionPaths.has(p) && !renameSourcePaths.has(p));

    let generator: StoryIndexGenerator;
    let index: StoryIndex;
    try {
      generator = await storyIndexGeneratorPromise;
      index = await generator.getIndex();
    } catch {
      (await storyIndexGeneratorPromise).clearSnapshots();
      return;
    }

    const removedSnapshots = generator.getRemovedFileSnapshots();
    const modifiedSnapshots = generator.getModifiedFileSnapshots();

    // 1. File-rename pairs (existing file-rename path).
    const { renames: fileRenamePairs, unresolved } = resolveRenamePairs(
      renameCandidates,
      removedSnapshots,
      index,
      workingDir,
    );

    // Origin of a file-rename pair is the old absolute path. Build a lookup
    // from old story ID to absolute source path so we can stamp each pair.
    const candidateOriginByOldId = new Map<StoryId, Path>();
    for (const { oldPath } of renameCandidates) {
      const absOld = resolve(workingDir, oldPath);
      const snap = removedSnapshots.get(absOld);
      if (!snap) continue;
      for (const { id } of Object.values(snap.stories)) {
        candidateOriginByOldId.set(id, absOld);
      }
    }
    const eventRenames: Rename[] = fileRenamePairs.map((pair) => ({
      ...pair,
      origin: candidateOriginByOldId.get(pair.oldId) ?? '',
    }));

    // 2. Unresolved file-rename candidates become orphans
    const eventOrphans: Orphan[] = [];
    for (const oldPath of unresolved) {
      const absOld = resolve(workingDir, oldPath);
      const snap = removedSnapshots.get(absOld);
      if (!snap) continue;
      for (const { id } of Object.values(snap.stories)) {
        eventOrphans.push({ id, origin: absOld });
      }
    }

    // 3. Modifications
    for (const path of modifications) {
      const absPath = resolve(workingDir, path);
      const oldSnap = modifiedSnapshots.get(absPath);
      if (!oldSnap) continue;

      // Reconstruct "new" snapshot from the re-indexed entries at this path
      const newSnap: FileSnapshot = { stories: {}, docs: [] };
      for (const entry of Object.values(index.entries)) {
        if (entry.importPath !== path && entry.importPath !== absPath) continue;
        if (entry.type === 'story') {
          const exportName = (entry as { exportName?: string }).exportName;
          if (exportName) newSnap.stories[exportName] = { id: entry.id };
        } else if (entry.type === 'docs') {
          newSnap.docs.push({ id: entry.id, name: entry.name });
        }
      }

      const { renames, orphans } = classifyFileChange(oldSnap, newSnap);
      for (const r of renames) {
        eventRenames.push({ ...r, origin: absPath });
      }
      for (const id of orphans) {
        eventOrphans.push({ id, origin: absPath });
      }
    }

    // 4. Confirmed file deletions
    const eventDeletions: Deletion[] = [];
    for (const path of deletions) {
      const absPath = resolve(workingDir, path);
      const snap = removedSnapshots.get(absPath);
      if (!snap) continue;
      for (const { id } of Object.values(snap.stories)) {
        eventDeletions.push({ id, origin: absPath });
      }
    }

    generator.clearSnapshots();

    if (eventRenames.length === 0 && eventOrphans.length === 0 && eventDeletions.length === 0) {
      return;
    }

    await renameRedirectStore.untilReady();
    renameRedirectStore.setState((prev) =>
      extendRenameMaps(prev, {
        renames: eventRenames,
        orphans: eventOrphans,
        deletions: eventDeletions,
      }),
    );
  },
  DEBOUNCE,
  { edges: ['leading', 'trailing'] },
);
```

Import `resolve` from `node:path` and `StoryId`, `Path` from `storybook/internal/types` if not already present.

- [ ] **Step 2: Run existing orchestration tests**

Run: `yarn test run code/core/src/core-server/utils/index-json.test.ts`
Expected: PASS — existing tests cover file rename, deletion; the new code path is silent without modifications.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/core-server/utils/index-json.ts
git commit -m "feat(rename-detect): classify modifications and route orphans through the store"
```

---

## Task 18: Orchestration test for meta.title rename

**Files:**

- Modify: `code/core/src/core-server/utils/index-json.test.ts`

- [ ] **Step 1: Add the test**

Inside the existing `rename redirect store` describe:

```typescript
it('writes a rename chain when a modified file has shared exports with changed IDs', async () => {
  const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
  const storyIndexGeneratorPromise = getStoryIndexGeneratorPromise();
  registerIndexJsonRoute({
    app,
    channel: mockServerChannel,
    workingDir,
    normalizedStories,
    storyIndexGeneratorPromise,
  });

  const generator = await storyIndexGeneratorPromise;
  await generator.getIndex();

  // Hand-seed a modifiedFileSnapshot that differs from the current cache entry:
  // pretend B.stories.ts previously indexed to a different id under the same export.
  const absPath = join(workingDir, 'src/B.stories.ts');
  const modSnaps = generator.getModifiedFileSnapshots();
  modSnaps.set(absPath, {
    stories: { StoryOne: { id: 'old--story-one' } },
    docs: [],
  });

  // Drive an onChange event to fire the modification path and flush the debounce
  const watcher = Watchpack.mock.instances[0];
  const onChange = watcher.on.mock.calls[0][1];
  // pendingModifications is populated when removed=false and no renameHint
  onChange(absPath);

  await vi.waitFor(() => {
    expect(renameRedirectStore.getState().chains['old--story-one']).toEqual(['b--story-one']);
  });
  expect(renameRedirectStore.getState().origins['old--story-one']).toBe(absPath);
});
```

- [ ] **Step 2: Run the test**

Run: `yarn test run code/core/src/core-server/utils/index-json.test.ts -t "shared exports with changed IDs"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/core-server/utils/index-json.test.ts
git commit -m "test(rename-detect): orchestrator writes rename on shared-export id change"
```

---

## Task 19: Orchestration test for export-level orphan (no chain, origin only)

**Files:**

- Modify: `code/core/src/core-server/utils/index-json.test.ts`

- [ ] **Step 1: Add the test**

```typescript
it('writes origin but no chain when an export disappears', async () => {
  const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
  const storyIndexGeneratorPromise = getStoryIndexGeneratorPromise();
  registerIndexJsonRoute({
    app,
    channel: mockServerChannel,
    workingDir,
    normalizedStories,
    storyIndexGeneratorPromise,
  });

  const generator = await storyIndexGeneratorPromise;
  await generator.getIndex();

  // Pretend B.stories.ts previously had an extra export Primary that is now gone.
  const absPath = join(workingDir, 'src/B.stories.ts');
  generator.getModifiedFileSnapshots().set(absPath, {
    stories: {
      StoryOne: { id: 'b--story-one' },
      Primary: { id: 'b--primary' },
    },
    docs: [],
  });

  const watcher = Watchpack.mock.instances[0];
  const onChange = watcher.on.mock.calls[0][1];
  onChange(absPath);

  await vi.waitFor(() => {
    expect(renameRedirectStore.getState().origins['b--primary']).toBe(absPath);
  });
  expect(renameRedirectStore.getState().chains['b--primary']).toBeUndefined();
});
```

- [ ] **Step 2: Run the test**

Run: `yarn test run code/core/src/core-server/utils/index-json.test.ts -t "writes origin but no chain"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/core-server/utils/index-json.test.ts
git commit -m "test(rename-detect): orphan produces origin-only store write"
```

---

## Task 20: Orchestration test for same-path deletion trumps modification

**Files:**

- Modify: `code/core/src/core-server/utils/index-json.test.ts`

- [ ] **Step 1: Add the test**

```typescript
it('does not classify a modification when the same path is also deleted in the same cycle', async () => {
  const mockServerChannel = { emit: vi.fn() } as any as ServerChannel;
  const storyIndexGeneratorPromise = getStoryIndexGeneratorPromise();
  registerIndexJsonRoute({
    app,
    channel: mockServerChannel,
    workingDir,
    normalizedStories,
    storyIndexGeneratorPromise,
  });

  const generator = await storyIndexGeneratorPromise;
  await generator.getIndex();

  const absPath = join(workingDir, 'src/B.stories.ts');
  // Seed a modified snapshot that would otherwise classify as orphan:
  generator.getModifiedFileSnapshots().set(absPath, {
    stories: { StoryOne: { id: 'b--story-one' }, Primary: { id: 'b--primary' } },
    docs: [],
  });
  // Seed the removed snapshot that will drive the deletion branch:
  generator.getRemovedFileSnapshots().set(absPath, {
    stories: { StoryOne: { id: 'b--story-one' }, Primary: { id: 'b--primary' } },
    docs: [],
  });

  const watcher = Watchpack.mock.instances[0];
  const onChange = watcher.on.mock.calls[0][1];
  const onRemove = watcher.on.mock.calls[1][1];
  onChange(absPath);
  onRemove(absPath);

  await vi.waitFor(() => {
    // Both IDs should have null-chain deletion entries (from deletion path)
    expect(renameRedirectStore.getState().chains['b--primary']).toEqual([null]);
    expect(renameRedirectStore.getState().chains['b--story-one']).toEqual([null]);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `yarn test run code/core/src/core-server/utils/index-json.test.ts -t "deletion in the same cycle"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/core-server/utils/index-json.test.ts
git commit -m "test(rename-detect): deletion beats modification on same path"
```

---

## Task 21: FollowupOverlay component

**Files:**

- Create: `code/core/src/manager/components/preview/FollowupOverlay.tsx`
- Create: `code/core/src/manager/components/preview/FollowupOverlay.test.tsx`

- [ ] **Step 1: Write a failing component test**

```tsx
// code/core/src/manager/components/preview/FollowupOverlay.test.tsx
import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FollowupOverlay } from './FollowupOverlay.tsx';

describe('FollowupOverlay', () => {
  const siblings = [
    { id: 'button--primary', type: 'story' as const, name: 'Primary', title: 'Button' },
    { id: 'button--secondary', type: 'story' as const, name: 'Secondary', title: 'Button' },
  ];

  it('renders "no longer here" heading by default', () => {
    render(
      <FollowupOverlay
        heading="This story is no longer here"
        siblings={siblings as any}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('This story is no longer here')).toBeDefined();
  });

  it('renders "was deleted" heading when requested', () => {
    render(
      <FollowupOverlay
        heading="This story was deleted"
        siblings={siblings as any}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('This story was deleted')).toBeDefined();
  });

  it('renders each sibling as a navigable link', () => {
    const onSelect = vi.fn();
    render(
      <FollowupOverlay
        heading="This story is no longer here"
        siblings={siblings as any}
        onSelect={onSelect}
      />,
    );
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('omits the docs button when no docsEntry is provided', () => {
    render(
      <FollowupOverlay
        heading="This story is no longer here"
        siblings={siblings as any}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByText(/docs/i)).toBeNull();
  });

  it('renders the docs button when a docsEntry is provided', () => {
    const docsEntry = {
      id: 'button--docs',
      type: 'docs' as const,
      name: 'Docs',
      title: 'Button',
    };
    render(
      <FollowupOverlay
        heading="This story is no longer here"
        siblings={siblings as any}
        docsEntry={docsEntry as any}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/take me to button docs/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `yarn test run code/core/src/manager/components/preview/FollowupOverlay.test.tsx`
Expected: FAIL — component module does not exist.

- [ ] **Step 3: Implement the component**

```tsx
// code/core/src/manager/components/preview/FollowupOverlay.tsx
import type { FC } from 'react';
import React from 'react';

import { Placeholder } from 'storybook/internal/components';
import type { API_DocsEntry, API_StoryEntry, StoryId } from 'storybook/internal/types';

import { styled } from 'storybook/theming';

const Overlay = styled.div(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: theme.background.content,
  zIndex: 2,
}));

const Panel = styled.div(({ theme }) => ({
  padding: 24,
  maxWidth: 520,
  color: theme.color.defaultText,
}));

const Heading = styled.h2(({ theme }) => ({
  margin: 0,
  marginBottom: 8,
  fontSize: theme.typography.size.m1,
  fontWeight: theme.typography.weight.bold,
}));

const List = styled.ul({
  listStyle: 'none',
  padding: 0,
  margin: '16px 0 0 0',
});

const Item = styled.li({
  marginBottom: 4,
});

const Link = styled.a(({ theme }) => ({
  color: theme.color.secondary,
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textDecoration: 'underline',
}));

const DocsButton = styled.button(({ theme }) => ({
  marginTop: 16,
  padding: '8px 12px',
  borderRadius: theme.appBorderRadius,
  border: `1px solid ${theme.appBorderColor}`,
  background: theme.background.app,
  color: theme.color.defaultText,
  cursor: 'pointer',
}));

export type FollowupOverlayProps = {
  heading: 'This story is no longer here' | 'This story was deleted';
  siblings: API_StoryEntry[];
  docsEntry?: API_DocsEntry;
  onSelect: (id: StoryId) => void;
};

export const FollowupOverlay: FC<FollowupOverlayProps> = ({
  heading,
  siblings,
  docsEntry,
  onSelect,
}) => {
  return (
    <Overlay role="status">
      <Placeholder>
        <Panel>
          <Heading>{heading}</Heading>
          {siblings.length > 0 && (
            <>
              <div>Here are some recently added stories:</div>
              <List>
                {siblings.map((s) => (
                  <Item key={s.id}>
                    <Link role="link" onClick={() => onSelect(s.id)} tabIndex={0}>
                      {s.title} — {s.name}
                    </Link>
                  </Item>
                ))}
              </List>
            </>
          )}
          {docsEntry && (
            <DocsButton onClick={() => onSelect(docsEntry.id)}>
              Take me to {docsEntry.title} docs
            </DocsButton>
          )}
        </Panel>
      </Placeholder>
    </Overlay>
  );
};
```

- [ ] **Step 4: Run tests**

Run: `yarn test run code/core/src/manager/components/preview/FollowupOverlay.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/manager/components/preview/FollowupOverlay.tsx code/core/src/manager/components/preview/FollowupOverlay.test.tsx
git commit -m "feat(rename-detect): FollowupOverlay component"
```

---

## Task 22: Wire FollowupOverlay into Preview.tsx (replaces DeletionOverlay)

**Files:**

- Modify: `code/core/src/manager/components/preview/Preview.tsx`

- [ ] **Step 1: Replace the deletion detection + overlay with the followup wiring**

Remove the `isKnownDeletion` helper, the `DeletionOverlay` styled component, the `storyWasDeleted` prop, and the inline overlay block from the previous spec. Add the new wiring:

```tsx
import { FollowupOverlay } from './FollowupOverlay.tsx';
```

Extend `canvasMapper`:

```typescript
const canvasMapper = ({ state, api }: Combo) => {
  const entry = api.getData(state.storyId, state.refId);
  const { chains, origins } = renameRedirectStore.getState();
  const storyId = state.storyId;
  const originPath = storyId ? origins[storyId] : undefined;
  const chain = storyId ? chains[storyId] : undefined;
  const index = state.internal_index;

  const siblings =
    originPath && index
      ? (Object.values(index.entries).filter(
          (e: any) => e.importPath === originPath && e.type === 'story',
        ) as API_StoryEntry[])
      : [];
  const docsEntry =
    originPath && index
      ? (Object.values(index.entries).find(
          (e: any) => e.importPath === originPath && e.type === 'docs',
        ) as API_DocsEntry | undefined)
      : undefined;

  const isKnownDeletion =
    chain !== undefined && chain.length > 0 && chain[chain.length - 1] === null;
  const followupHeading: FollowupOverlayProps['heading'] | undefined =
    entry || !originPath
      ? undefined
      : isKnownDeletion
        ? 'This story was deleted'
        : 'This story is no longer here';

  return {
    api,
    storyId: state.storyId,
    refId: state.refId,
    viewMode: state.viewMode,
    customCanvas: api.renderPreview,
    queryParams: state.customQueryParams,
    getElements: api.getElements,
    entry,
    previewInitialized: state.previewInitialized,
    refs: state.refs,
    followup: followupHeading
      ? {
          heading: followupHeading,
          siblings,
          docsEntry,
        }
      : undefined,
  };
};
```

Inside `Canvas`'s render, after `<ApplyWrappers>...</ApplyWrappers>`:

```tsx
{
  followup && (
    <FollowupOverlay
      heading={followup.heading}
      siblings={followup.siblings}
      docsEntry={followup.docsEntry}
      onSelect={(id) => api.selectStory(id)}
    />
  );
}
```

Destructure `followup` from the consumer args alongside the rest.

Also import `API_DocsEntry`, `API_StoryEntry` from `storybook/internal/types` if not already present, and the `FollowupOverlayProps` type from the component.

- [ ] **Step 2: Run typecheck**

Run: `cd code && yarn tsc --noEmit -p core/tsconfig.json`
Expected: no new errors for `Preview.tsx`.

- [ ] **Step 3: Run relevant tests**

Run: `yarn test run code/core/src/manager/components/preview/FollowupOverlay.test.tsx`
Expected: PASS (no regression in the component's isolated tests).

- [ ] **Step 4: Commit**

```bash
git add code/core/src/manager/components/preview/Preview.tsx
git commit -m "feat(rename-detect): wire FollowupOverlay in Preview"
```

---

## Task 23: Full-suite verification

**Files:** None modified.

- [ ] **Step 1: Run full lint and typecheck**

Run: `cd code && yarn lint && yarn nx run-many -t check`
Expected: clean exit.

- [ ] **Step 2: Run the full unit test suite**

Run: `yarn test run code/core/src`
Expected: all tests pass (modulo the pre-existing unrelated failures from earlier sessions in `wrap-utils.test.ts` and `detect-agent.test.ts`).

- [ ] **Step 3: Manual smoke via internal Storybook UI**

```bash
cd code && yarn storybook:ui
```

Verify in the browser:

1. Change `meta.title` of a component → navigation follows automatically.
2. Rename a component identifier used by autoTitle → same.
3. Rename a single export → landing on the old URL shows the FollowupOverlay with sibling stories; new story listed; docs button appears if autodocs was on.
4. Delete an export outright → FollowupOverlay with "no longer here" heading.
5. Delete a whole file → overlay with "was deleted" heading, empty sibling list (or whatever is left), docs button only if any docs remain.

- [ ] **Step 4: Commit empty marker (only if no fixes were needed)**

```bash
git commit --allow-empty -m "chore(rename-detect): full verification pass"
```

---

## Notes for the Implementer

- The existing file-rename work already depends on `renameRedirectStore` having `chains`; adding `origins` is purely additive.
- Origin resolution uses absolute paths (`resolve(workingDir, relativePath)`). This matches the way `removedFileSnapshots` and `modifiedFileSnapshots` are keyed, and gives the manager a stable identifier for sibling lookup via the index entry's `importPath`. If `importPath` in the index is relative, the orchestrator normalises to the same form before writing `origin` to the store.
- `renameRedirectStore.untilReady()` is awaited before `setState` — matches the server leader convention already in place for the prior spec.
- The `Preview.tsx` rendering change is the most UX-sensitive piece. Keep iteration quick: verify one scenario (title rename) end-to-end before polishing the styling.
- E2E sandbox tests are out of scope for this plan per the spec; manual verification via the internal UI is enough for the first landing.

## Self-Review Notes

Spec coverage verified:

- Classification algorithm (§2) → Tasks 1–6
- State shape (§3.1) → Task 7
- `extendRenameMaps` rename + origin semantics (§3.2) → Tasks 8–12
- `StoryIndexGenerator` (§3.3) → Tasks 13–15
- Orchestration (§3.4) → Tasks 16–20
- Manager redirect (§4.1) → unchanged, covered by existing tests
- FollowupOverlay (§4.2) → Tasks 21–22
- Breaking-change analysis (§5.1) → observed throughout; no public API changes
- Testing strategy (§5.2–§5.5) → distributed across tasks; E2E deferred to manual step in Task 23

Type consistency: `extendRenameMaps`, `RenameEvents`, `Rename`, `Orphan`, `Deletion`, `FileSnapshot`, `ClassifyResult`, `FollowupOverlayProps` are consistent across tasks. No function referenced that isn't defined.

Placeholder scan: no "TBD"/"TODO"/"fill in later" lines. All code blocks contain actual implementation ready to be pasted.
