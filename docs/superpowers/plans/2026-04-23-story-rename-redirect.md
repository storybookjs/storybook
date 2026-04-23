# Story Rename Redirect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect file renames and deletions during HMR and redirect the UI from stale story URLs to the current story (or show a specialised "story deleted" notice).

**Architecture:** Server watches files via Watchpack, snapshots removed-file export→storyId maps before cache deletion, matches rename pairs using export-name fingerprints (cross-platform). After re-indexing, server writes rename chains to a UniversalStore (leader). Manager (follower) reads the store synchronously inside `setIndex()` to redirect via `selectStory()` or render a specialised 404.

**Tech Stack:** TypeScript, Vitest, Watchpack, Storybook UniversalStore, Storybook channels.

**Spec:** [docs/superpowers/specs/2026-04-22-story-rename-redirect-design.md](../specs/2026-04-22-story-rename-redirect-design.md)

---

## File Structure

**New files:**
- `code/core/src/shared/rename-redirect-store/index.ts` — state shape, `applyRenameChains` pure function, `UNIVERSAL_RENAME_REDIRECT_STORE_OPTIONS`
- `code/core/src/shared/rename-redirect-store/index.test.ts` — unit tests for `applyRenameChains`
- `code/core/src/core-server/stores/rename-redirect.ts` — server leader instance
- `code/core/src/manager-api/stores/rename-redirect.ts` — manager follower instance

**Modified files:**
- `code/core/src/core-server/utils/StoryIndexGenerator.ts` — add `removedFileSnapshots` map, `getRemovedFileSnapshots()`, `clearRemovedFileSnapshots()`, snapshot capture in `invalidate()`
- `code/core/src/core-server/utils/watch-story-specifiers.ts` — detect rename candidate pairs in batch processor, extend `onInvalidate` callback signature
- `code/core/src/core-server/utils/index-json.ts` — after invalidation debounce, await re-index, pair rename candidates via fingerprint, write to store
- `code/core/src/manager-api/modules/stories.ts` — in `setIndex()`, after state update, check rename store and redirect or mark deletion
- `code/core/src/manager/components/preview/Preview.tsx` (or relevant 404 UI) — render specialised "story deleted" message when chain ends in `null`

---

## Task 1: RenameRedirectState type and empty store options

**Files:**
- Create: `code/core/src/shared/rename-redirect-store/index.ts`

- [ ] **Step 1: Create the file with state shape and options**

```typescript
// code/core/src/shared/rename-redirect-store/index.ts
import type { StoryId } from '../../types/index.ts';
import type { StoreOptions } from '../universal-store/types.ts';

export type RenameRedirectChain = (StoryId | null)[];

export type RenameRedirectState = {
  chains: Record<StoryId, RenameRedirectChain>;
};

export const INITIAL_RENAME_REDIRECT_STATE: RenameRedirectState = { chains: {} };

export const UNIVERSAL_RENAME_REDIRECT_STORE_OPTIONS: StoreOptions<RenameRedirectState> = {
  id: 'storybook/rename-redirect',
  initialState: INITIAL_RENAME_REDIRECT_STATE,
};
```

- [ ] **Step 2: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/index.ts
git commit -m "feat(rename-redirect): add state shape and store options"
```

---

## Task 2: applyRenameChains — single rename case (TDD)

**Files:**
- Create: `code/core/src/shared/rename-redirect-store/index.test.ts`
- Modify: `code/core/src/shared/rename-redirect-store/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// code/core/src/shared/rename-redirect-store/index.test.ts
import { describe, expect, it } from 'vitest';

import { applyRenameChains, INITIAL_RENAME_REDIRECT_STATE } from './index.ts';

describe('applyRenameChains', () => {
  it('records a single rename as a new chain entry', () => {
    const result = applyRenameChains(
      INITIAL_RENAME_REDIRECT_STATE,
      [{ oldId: 'button--primary', newId: 'button--secondary' }],
      []
    );
    expect(result.chains).toEqual({ 'button--primary': ['button--secondary'] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && yarn vitest run core/src/shared/rename-redirect-store/index.test.ts`
Expected: FAIL with "applyRenameChains is not a function" or similar.

- [ ] **Step 3: Add minimal implementation**

Append to `code/core/src/shared/rename-redirect-store/index.ts`:

```typescript
export type Rename = { oldId: StoryId; newId: StoryId };

export function applyRenameChains(
  current: RenameRedirectState,
  renames: Rename[],
  deletions: StoryId[]
): RenameRedirectState {
  const chains = { ...current.chains };
  for (const { oldId, newId } of renames) {
    chains[oldId] = [newId];
  }
  return { chains };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && yarn vitest run core/src/shared/rename-redirect-store/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/
git commit -m "feat(rename-redirect): applyRenameChains handles single rename"
```

---

## Task 3: applyRenameChains — transitive chain extension

**Files:**
- Modify: `code/core/src/shared/rename-redirect-store/index.test.ts`
- Modify: `code/core/src/shared/rename-redirect-store/index.ts`

- [ ] **Step 1: Add the failing test**

Append to the `describe` block:

```typescript
  it('extends existing chains when rename destination matches previous last element', () => {
    const initial: RenameRedirectState = { chains: { 'a--x': ['b--x'] } };
    const result = applyRenameChains(initial, [{ oldId: 'b--x', newId: 'c--x' }], []);
    expect(result.chains).toEqual({
      'a--x': ['b--x', 'c--x'],
      'b--x': ['c--x'],
    });
  });
```

Add the import update if needed:

```typescript
import {
  applyRenameChains,
  INITIAL_RENAME_REDIRECT_STATE,
  type RenameRedirectState,
} from './index.ts';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && yarn vitest run core/src/shared/rename-redirect-store/index.test.ts`
Expected: FAIL — only `b--x: [c--x]` is written, `a--x` chain is not extended.

- [ ] **Step 3: Update implementation**

Replace `applyRenameChains` body:

```typescript
export function applyRenameChains(
  current: RenameRedirectState,
  renames: Rename[],
  deletions: StoryId[]
): RenameRedirectState {
  const chains = { ...current.chains };
  for (const { oldId, newId } of renames) {
    for (const source of Object.keys(chains)) {
      const chain = chains[source];
      if (chain.length > 0 && chain[chain.length - 1] === oldId) {
        chains[source] = [...chain, newId];
      }
    }
    chains[oldId] = [...(chains[oldId] ?? []), newId];
  }
  return { chains };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && yarn vitest run core/src/shared/rename-redirect-store/index.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/
git commit -m "feat(rename-redirect): applyRenameChains extends transitive chains"
```

---

## Task 4: applyRenameChains — round-trip loop prevention

**Files:**
- Modify: `code/core/src/shared/rename-redirect-store/index.test.ts`
- Modify: `code/core/src/shared/rename-redirect-store/index.ts`

- [ ] **Step 1: Add the failing test**

Append to the `describe` block:

```typescript
  it('drops entries where chain last element equals source key (round-trip)', () => {
    const step1 = applyRenameChains(
      INITIAL_RENAME_REDIRECT_STATE,
      [{ oldId: 'a--x', newId: 'b--x' }],
      []
    );
    const step2 = applyRenameChains(step1, [{ oldId: 'b--x', newId: 'a--x' }], []);
    // a--x chain becomes ['b--x', 'a--x'] — last equals source — drop.
    // b--x chain becomes ['a--x'] — last does not equal source — keep.
    expect(step2.chains).toEqual({ 'b--x': ['a--x'] });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && yarn vitest run core/src/shared/rename-redirect-store/index.test.ts`
Expected: FAIL — `a--x: ['b--x', 'a--x']` is not dropped.

- [ ] **Step 3: Update implementation**

Replace `applyRenameChains` body to add the loop-prevention sweep:

```typescript
export function applyRenameChains(
  current: RenameRedirectState,
  renames: Rename[],
  deletions: StoryId[]
): RenameRedirectState {
  const chains = { ...current.chains };
  for (const { oldId, newId } of renames) {
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
  return { chains };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && yarn vitest run core/src/shared/rename-redirect-store/index.test.ts`
Expected: PASS (three tests).

- [ ] **Step 5: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/
git commit -m "feat(rename-redirect): applyRenameChains drops round-trip entries"
```

---

## Task 5: applyRenameChains — deletion handling

**Files:**
- Modify: `code/core/src/shared/rename-redirect-store/index.test.ts`
- Modify: `code/core/src/shared/rename-redirect-store/index.ts`

- [ ] **Step 1: Add failing tests**

Append to the `describe` block:

```typescript
  it('records a deletion with a null-terminated chain', () => {
    const result = applyRenameChains(INITIAL_RENAME_REDIRECT_STATE, [], ['gone--story']);
    expect(result.chains).toEqual({ 'gone--story': [null] });
  });

  it('appends null to the end of existing chain when rename-then-delete occurs', () => {
    const renamed = applyRenameChains(
      INITIAL_RENAME_REDIRECT_STATE,
      [{ oldId: 'a--x', newId: 'b--x' }],
      []
    );
    const deleted = applyRenameChains(renamed, [], ['b--x']);
    expect(deleted.chains).toEqual({
      'a--x': ['b--x', null],
      'b--x': [null],
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && yarn vitest run core/src/shared/rename-redirect-store/index.test.ts`
Expected: FAIL — deletions not handled.

- [ ] **Step 3: Extend implementation**

Add a deletion pass after the rename loop:

```typescript
export function applyRenameChains(
  current: RenameRedirectState,
  renames: Rename[],
  deletions: StoryId[]
): RenameRedirectState {
  const chains = { ...current.chains };
  for (const { oldId, newId } of renames) {
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
  for (const deletedId of deletions) {
    for (const source of Object.keys(chains)) {
      const chain = chains[source];
      if (chain.length > 0 && chain[chain.length - 1] === deletedId) {
        chains[source] = [...chain, null];
      }
    }
    chains[deletedId] = [...(chains[deletedId] ?? []), null];
  }
  return { chains };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd code && yarn vitest run core/src/shared/rename-redirect-store/index.test.ts`
Expected: PASS (five tests).

- [ ] **Step 5: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/
git commit -m "feat(rename-redirect): applyRenameChains handles deletions"
```

---

## Task 6: applyRenameChains — folder rename (multi-pair batch)

**Files:**
- Modify: `code/core/src/shared/rename-redirect-store/index.test.ts`

- [ ] **Step 1: Add the test**

Append to the `describe` block:

```typescript
  it('handles multiple independent renames in one call (folder rename)', () => {
    const result = applyRenameChains(
      INITIAL_RENAME_REDIRECT_STATE,
      [
        { oldId: 'old--a', newId: 'new--a' },
        { oldId: 'old--b', newId: 'new--b' },
      ],
      []
    );
    expect(result.chains).toEqual({
      'old--a': ['new--a'],
      'old--b': ['new--b'],
    });
  });
```

- [ ] **Step 2: Run the test**

Run: `cd code && yarn vitest run core/src/shared/rename-redirect-store/index.test.ts`
Expected: PASS — existing implementation already supports this.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/shared/rename-redirect-store/
git commit -m "test(rename-redirect): cover folder rename multi-pair case"
```

---

## Task 7: Server leader store instance

**Files:**
- Create: `code/core/src/core-server/stores/rename-redirect.ts`

- [ ] **Step 1: Create the server store instance**

```typescript
// code/core/src/core-server/stores/rename-redirect.ts
import { optionalEnvToBoolean } from '../../common/utils/envs.ts';
import {
  UNIVERSAL_RENAME_REDIRECT_STORE_OPTIONS,
  type RenameRedirectState,
} from '../../shared/rename-redirect-store/index.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';

export const renameRedirectStore = UniversalStore.create<RenameRedirectState>({
  ...UNIVERSAL_RENAME_REDIRECT_STORE_OPTIONS,
  leader: !optionalEnvToBoolean(process.env.VITEST_CHILD_PROCESS),
});
```

- [ ] **Step 2: Verify import resolves**

Run: `cd code && yarn nx compile core`
Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/core-server/stores/rename-redirect.ts
git commit -m "feat(rename-redirect): server leader UniversalStore instance"
```

---

## Task 8: Manager follower store instance

**Files:**
- Create: `code/core/src/manager-api/stores/rename-redirect.ts`

- [ ] **Step 1: Create the manager store instance**

```typescript
// code/core/src/manager-api/stores/rename-redirect.ts
import {
  UNIVERSAL_RENAME_REDIRECT_STORE_OPTIONS,
  type RenameRedirectState,
} from '../../shared/rename-redirect-store/index.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';

export const renameRedirectStore = UniversalStore.create<RenameRedirectState>({
  ...UNIVERSAL_RENAME_REDIRECT_STORE_OPTIONS,
  leader: globalThis.CONFIG_TYPE === 'PRODUCTION',
});
```

- [ ] **Step 2: Verify import resolves**

Run: `cd code && yarn nx compile core`
Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/manager-api/stores/rename-redirect.ts
git commit -m "feat(rename-redirect): manager follower UniversalStore instance"
```

---

## Task 9: StoryIndexGenerator — snapshot removed file entries (TDD)

**Files:**
- Modify: `code/core/src/core-server/utils/StoryIndexGenerator.ts`
- Modify: `code/core/src/core-server/utils/StoryIndexGenerator.test.ts`

- [ ] **Step 1: Add the failing test**

Locate `StoryIndexGenerator.test.ts` and add a new `describe` block (or extend existing one) near the `invalidate` tests:

```typescript
describe('removed file snapshots', () => {
  it('captures exportName→storyId map before deleting removed-file cache entry', async () => {
    const generator = new StoryIndexGenerator(
      [storiesSpecifier],
      options
    );
    await generator.getIndex();
    const path = './src/A.stories.ts';
    const absolutePath = resolve(options.workingDir, path);

    generator.invalidate(path, true);

    const snapshots = generator.getRemovedFileSnapshots();
    expect(snapshots.get(absolutePath)).toBeDefined();
    expect(Object.keys(snapshots.get(absolutePath)!).length).toBeGreaterThan(0);
  });
});
```

Note: the engineer should read the existing test file to match the imports, `storiesSpecifier`, and `options` variables in scope. The test fixture path must exist in the test setup.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && yarn vitest run core/src/core-server/utils/StoryIndexGenerator.test.ts -t "removed file snapshots"`
Expected: FAIL — `getRemovedFileSnapshots` does not exist.

- [ ] **Step 3: Add the snapshot fields and accessors**

In `StoryIndexGenerator.ts`, add fields near the other private fields (around line 104):

```typescript
  private removedFileSnapshots: Map<Path, Record<string, StoryId>> = new Map();
```

Add public accessors near the bottom of the class:

```typescript
  getRemovedFileSnapshots(): Map<Path, Record<string, StoryId>> {
    return this.removedFileSnapshots;
  }

  clearRemovedFileSnapshots(): void {
    this.removedFileSnapshots.clear();
  }
```

In `invalidate()`, before `delete cache[absolutePath]` (around line 854), insert:

```typescript
    if (removed && cacheEntry && cacheEntry.type === 'stories') {
      const snapshot: Record<string, StoryId> = {};
      for (const entry of cacheEntry.entries) {
        if (entry.type === 'story' && 'exportName' in entry && entry.exportName) {
          snapshot[entry.exportName] = entry.id;
        }
      }
      if (Object.keys(snapshot).length > 0) {
        this.removedFileSnapshots.set(absolutePath, snapshot);
      }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && yarn vitest run core/src/core-server/utils/StoryIndexGenerator.test.ts -t "removed file snapshots"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/core-server/utils/StoryIndexGenerator.ts code/core/src/core-server/utils/StoryIndexGenerator.test.ts
git commit -m "feat(rename-redirect): StoryIndexGenerator snapshots removed files"
```

---

## Task 10: StoryIndexGenerator — clear snapshots accessor test

**Files:**
- Modify: `code/core/src/core-server/utils/StoryIndexGenerator.test.ts`

- [ ] **Step 1: Add the test**

Append to the `removed file snapshots` describe:

```typescript
  it('clearRemovedFileSnapshots() empties the snapshot map', async () => {
    const generator = new StoryIndexGenerator([storiesSpecifier], options);
    await generator.getIndex();
    generator.invalidate('./src/A.stories.ts', true);

    expect(generator.getRemovedFileSnapshots().size).toBeGreaterThan(0);
    generator.clearRemovedFileSnapshots();
    expect(generator.getRemovedFileSnapshots().size).toBe(0);
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd code && yarn vitest run core/src/core-server/utils/StoryIndexGenerator.test.ts -t "clearRemovedFileSnapshots"`
Expected: PASS (accessor already exists from Task 9).

- [ ] **Step 3: Commit**

```bash
git add code/core/src/core-server/utils/StoryIndexGenerator.test.ts
git commit -m "test(rename-redirect): cover clearRemovedFileSnapshots"
```

---

## Task 11: watch-story-specifiers — extend onInvalidate signature with renameHint

**Files:**
- Modify: `code/core/src/core-server/utils/watch-story-specifiers.ts`
- Modify: `code/core/src/core-server/utils/watch-story-specifiers.test.ts`

- [ ] **Step 1: Add the failing test**

Open the test file and add a new test that fires two rename events (one removal, one addition) in the same 100ms window and asserts the callback receives a `renameHint`:

```typescript
describe('rename detection', () => {
  it('pairs rename-explanation remove + add events into a renameHint', async () => {
    const onInvalidate = vi.fn();
    const unwatch = watchStorySpecifiers(
      [specifier],
      { workingDir },
      onInvalidate
    );

    // Simulate Watchpack firing both halves of a rename within the batch window
    wpMock.emit('change', oldAbsolutePath, undefined, 'rename');
    wpMock.emit('change', newAbsolutePath, new Date(), 'rename');

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(onInvalidate).toHaveBeenCalledWith(
      oldImportPath,
      true,
      { pairedWith: newImportPath }
    );
    expect(onInvalidate).toHaveBeenCalledWith(
      newImportPath,
      false,
      undefined
    );

    unwatch();
  });
});
```

Note: the engineer should read the existing test file to understand the `wpMock` / test harness pattern and adjust imports and helpers accordingly.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && yarn vitest run core/src/core-server/utils/watch-story-specifiers.test.ts -t "rename detection"`
Expected: FAIL — callback is called without `renameHint`.

- [ ] **Step 3: Implement rename pair detection in the batch processor**

In `watch-story-specifiers.ts`, change the type of `pendingEvents` to include explanation and implement pairing in the batch flush.

Replace the existing `pendingEvents` declaration and `queueEvent`/`wp.on('change')` handlers:

```typescript
  const pendingEvents = new Map<Path, { removed: boolean; explanation: string }>();
  let batchTimeout: ReturnType<typeof setTimeout> | undefined;

  function queueEvent(absolutePath: Path, removed: boolean, explanation: string) {
    pendingEvents.set(absolutePath, { removed, explanation });
    if (batchTimeout) {
      clearTimeout(batchTimeout);
    }
    batchTimeout = setTimeout(async () => {
      batchTimeout = undefined;
      const events = new Map(pendingEvents);
      pendingEvents.clear();

      // Identify rename pairs: 1 removal + 1 addition both with explanation='rename'
      const renameRemovals: Path[] = [];
      const renameAdditions: Path[] = [];
      for (const [path, { removed, explanation }] of events) {
        if (explanation === 'rename') {
          (removed ? renameRemovals : renameAdditions).push(path);
        }
      }
      const pairs = new Map<Path, Path>();
      if (renameRemovals.length === 1 && renameAdditions.length === 1) {
        pairs.set(renameRemovals[0], renameAdditions[0]);
      }
      // Multi-pair disambiguation happens later in index-json via fingerprint match.
      // Pass all rename candidates through as hints so the orchestrator can resolve them.

      await Promise.all(
        Array.from(events.entries()).map(async ([path, { removed, explanation }]) => {
          const isRenameCandidate = explanation === 'rename';
          let renameHint: { pairedWith: Path } | undefined;
          if (removed && isRenameCandidate) {
            const paired = pairs.get(path);
            if (paired) {
              renameHint = { pairedWith: paired };
            }
          }
          await onChangeOrRemove(path, removed, renameHint);
        })
      );
    }, 100);
  }

  wp.on('change', (filePath: Path, mtime: Date, explanation: string) => {
    const removed = !mtime;
    queueEvent(filePath, removed, explanation);
  });
  wp.on('remove', (filePath: Path) => {
    queueEvent(filePath, true, 'remove');
  });
```

Update `onChangeOrRemove` to accept and forward the optional hint:

```typescript
  async function onChangeOrRemove(
    absolutePath: Path,
    removed: boolean,
    renameHint?: { pairedWith: Path }
  ) {
    const importPath = toImportPath(absolutePath);
    const matchingSpecifier = specifiers.find((ns) =>
      ns.importPathMatcher.exec(importPath)
    );
    if (matchingSpecifier) {
      const hintImportPath = renameHint
        ? { pairedWith: toImportPath(renameHint.pairedWith) }
        : undefined;
      onInvalidate(importPath, removed, hintImportPath);
      return;
    }
    // ... existing directory-add branch unchanged
  }
```

Also update the `onInvalidate` parameter type:

```typescript
export function watchStorySpecifiers(
  specifiers: NormalizedStoriesSpecifier[],
  options: { workingDir: Path },
  onInvalidate: (
    path: Path,
    removed: boolean,
    renameHint?: { pairedWith: Path }
  ) => void
) {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && yarn vitest run core/src/core-server/utils/watch-story-specifiers.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/core-server/utils/watch-story-specifiers.ts code/core/src/core-server/utils/watch-story-specifiers.test.ts
git commit -m "feat(rename-redirect): watch-story-specifiers emits renameHint for pairs"
```

---

## Task 12: watch-story-specifiers — ambiguous batches produce no hint

**Files:**
- Modify: `code/core/src/core-server/utils/watch-story-specifiers.test.ts`

- [ ] **Step 1: Add the test**

Append to the `rename detection` describe:

```typescript
  it('produces no renameHint when multiple removals and additions arrive together', async () => {
    const onInvalidate = vi.fn();
    const unwatch = watchStorySpecifiers([specifier], { workingDir }, onInvalidate);

    // Two rename pairs (folder rename) — ambiguous at this layer, defer disambiguation
    wpMock.emit('change', oldAbsolutePath, undefined, 'rename');
    wpMock.emit('change', oldAbsolutePath2, undefined, 'rename');
    wpMock.emit('change', newAbsolutePath, new Date(), 'rename');
    wpMock.emit('change', newAbsolutePath2, new Date(), 'rename');

    await new Promise((resolve) => setTimeout(resolve, 150));

    // All four callbacks fire with renameHint=undefined; multi-pair case handled in index-json
    expect(onInvalidate).toHaveBeenCalledTimes(4);
    for (const call of onInvalidate.mock.calls) {
      expect(call[2]).toBeUndefined();
    }

    unwatch();
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd code && yarn vitest run core/src/core-server/utils/watch-story-specifiers.test.ts -t "produces no renameHint"`
Expected: PASS — the implementation from Task 11 only pairs when exactly 1+1.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/core-server/utils/watch-story-specifiers.test.ts
git commit -m "test(rename-redirect): verify ambiguous batches emit no hint"
```

---

## Task 13: index-json — collect rename candidates from onInvalidate

**Files:**
- Modify: `code/core/src/core-server/utils/index-json.ts`

- [ ] **Step 1: Add candidate collection to the onInvalidate callback**

Locate the existing `watchStorySpecifiers` call (around line 51). Replace the callback and add module-level accumulators above `registerIndexJsonRoute`:

```typescript
export function registerIndexJsonRoute({
  app,
  storyIndexGeneratorPromise,
  workingDir = process.cwd(),
  configDir,
  channel,
  normalizedStories,
  onStoryIndexInvalidated,
}: {
  app: Polka;
  storyIndexGeneratorPromise: Promise<StoryIndexGenerator>;
  channel: ChannelLike;
  workingDir?: string;
  configDir?: string;
  normalizedStories: NormalizedStoriesSpecifier[];
  onStoryIndexInvalidated?: () => void;
}) {
  // Rename/deletion accumulators for the current debounce cycle.
  // These are written by onInvalidate and drained by maybeInvalidate.
  type RenameCandidate = { oldPath: Path; newPath: Path };
  const pendingRenameCandidates: RenameCandidate[] = [];
  const pendingDeletions: Path[] = [];
  const pendingHintedRemovals = new Set<Path>();

  // ... existing maybeInvalidate (kept unchanged for now)

  watchStorySpecifiers(normalizedStories, { workingDir }, async (path, removed, renameHint) => {
    (await storyIndexGeneratorPromise).invalidate(path, removed);
    if (removed) {
      if (renameHint) {
        pendingRenameCandidates.push({ oldPath: path, newPath: renameHint.pairedWith });
        pendingHintedRemovals.add(path);
      } else {
        pendingDeletions.push(path);
      }
    }
    maybeInvalidate();
  });
  // ... rest unchanged
}
```

Note: the import for `Path` type may need to be added. Refer to the existing file for import conventions.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd code && yarn nx run-many -t check`
Expected: no errors in the modified file.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/core-server/utils/index-json.ts
git commit -m "feat(rename-redirect): collect rename candidates per invalidation cycle"
```

---

## Task 14: index-json — fingerprint match and old/new ID alignment helper

**Files:**
- Modify: `code/core/src/core-server/utils/index-json.ts`

- [ ] **Step 1: Add the matching helper**

Add this helper function near the top of the file, below imports:

```typescript
import type { StoryId, StoryIndex } from 'storybook/internal/types';

import { applyRenameChains } from '../../shared/rename-redirect-store/index.ts';

/**
 * Compute sorted export-name fingerprint string for comparison.
 */
function fingerprintOf(exportMap: Record<string, StoryId>): string {
  return Object.keys(exportMap).sort().join(',');
}

/**
 * Match removed-file snapshots to currently-indexed added files by fingerprint.
 * Returns the rename pairs as (oldId, newId) tuples aligned by export name.
 */
function resolveRenamePairs(
  candidates: { oldPath: Path; newPath: Path }[],
  removedSnapshots: Map<Path, Record<string, StoryId>>,
  index: StoryIndex,
  workingDir: string
): { renames: { oldId: StoryId; newId: StoryId }[]; unresolved: Path[] } {
  const renames: { oldId: StoryId; newId: StoryId }[] = [];
  const unresolved: Path[] = [];

  // Build new path → exportName → storyId from the index
  const newExportsByPath = new Map<Path, Record<string, StoryId>>();
  for (const entry of Object.values(index.entries)) {
    if (entry.type !== 'story') continue;
    const exportName = (entry as { exportName?: string }).exportName;
    if (!exportName) continue;
    const bucket = newExportsByPath.get(entry.importPath) ?? {};
    bucket[exportName] = entry.id;
    newExportsByPath.set(entry.importPath, bucket);
  }

  for (const { oldPath, newPath } of candidates) {
    const absOld = resolve(workingDir, oldPath);
    const oldSnap = removedSnapshots.get(absOld);
    const newSnap = newExportsByPath.get(newPath);

    if (!oldSnap || !newSnap || fingerprintOf(oldSnap) !== fingerprintOf(newSnap)) {
      unresolved.push(oldPath);
      continue;
    }

    for (const exportName of Object.keys(oldSnap)) {
      const oldId = oldSnap[exportName];
      const newId = newSnap[exportName];
      if (oldId && newId) {
        renames.push({ oldId, newId });
      }
    }
  }

  return { renames, unresolved };
}
```

Note: `resolve` should be imported from `node:path` if not already present. `Path` type is already used.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd code && yarn nx run-many -t check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/core-server/utils/index-json.ts
git commit -m "feat(rename-redirect): resolveRenamePairs fingerprint matcher"
```

---

## Task 15: index-json — drain and write to store after re-index

**Files:**
- Modify: `code/core/src/core-server/utils/index-json.ts`

- [ ] **Step 1: Replace the debounce body to drain accumulators and write to store**

Replace the existing `maybeInvalidate` declaration:

```typescript
import { renameRedirectStore } from '../stores/rename-redirect.ts';

// ... existing code ...

  const maybeInvalidate = debounce(
    async () => {
      channel.emit(STORY_INDEX_INVALIDATED);
      onStoryIndexInvalidated?.();

      if (pendingRenameCandidates.length === 0 && pendingDeletions.length === 0) {
        return;
      }

      // Snapshot the accumulators so they can be reset for the next cycle
      const renameCandidates = pendingRenameCandidates.splice(0);
      const deletions = pendingDeletions.splice(0);
      const hintedRemovals = new Set(pendingHintedRemovals);
      pendingHintedRemovals.clear();

      const generator = await storyIndexGeneratorPromise;
      let index: StoryIndex;
      try {
        index = await generator.getIndex();
      } catch {
        generator.clearRemovedFileSnapshots();
        return;
      }

      const removedSnapshots = generator.getRemovedFileSnapshots();
      const { renames, unresolved } = resolveRenamePairs(
        renameCandidates,
        removedSnapshots,
        index,
        workingDir
      );

      for (const unresolvedOldPath of unresolved) {
        logger.debug(
          `rename-redirect: could not confirm rename pair for ${unresolvedOldPath}, skipping`
        );
      }

      // Deletions list: explicit removals + unresolved rename removals are NOT treated as deletions
      // (spec: unresolved rename candidates produce nothing). Only explicit removals become null-terminated chains.
      const deletedIds: StoryId[] = [];
      for (const deletedPath of deletions) {
        const abs = resolve(workingDir, deletedPath);
        const snap = removedSnapshots.get(abs);
        if (snap) {
          deletedIds.push(...Object.values(snap));
        }
      }

      generator.clearRemovedFileSnapshots();

      if (renames.length === 0 && deletedIds.length === 0) {
        return;
      }

      await renameRedirectStore.untilReady();
      renameRedirectStore.setState((prev) => applyRenameChains(prev, renames, deletedIds));
    },
    DEBOUNCE,
    { edges: ['leading', 'trailing'] }
  );
```

Also add the `logger` import:

```typescript
import { logger } from 'storybook/internal/node-logger';
```

- [ ] **Step 2: Verify TypeScript and build**

Run: `cd code && yarn nx compile core`
Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/core-server/utils/index-json.ts
git commit -m "feat(rename-redirect): write rename chains to store after re-index"
```

---

## Task 16: index-json — integration test for store write after re-index

**Files:**
- Modify: `code/core/src/core-server/utils/index-json.test.ts` (create if missing)

- [ ] **Step 1: Write the integration test**

Write a test that:
1. Creates a mock `StoryIndexGenerator` whose `getIndex()` returns a fresh index and whose `getRemovedFileSnapshots()` returns a known snapshot.
2. Invokes the `onInvalidate` callback with `(oldPath, true, { pairedWith: newPath })` and `(newPath, false)`.
3. Waits past the DEBOUNCE window.
4. Asserts `renameRedirectStore.getState().chains` contains the expected `oldId: [newId]` entry.

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { renameRedirectStore } from '../stores/rename-redirect.ts';
import { registerIndexJsonRoute } from './index-json.ts';

describe('registerIndexJsonRoute — rename store write', () => {
  beforeEach(() => {
    renameRedirectStore.setState({ chains: {} });
  });

  it('writes rename chain entry after confirmed rename pair', async () => {
    // Test harness setup mirroring existing test patterns;
    // engineer should adapt to match mocks already used in this test file.
    // ... setup mock app, channel, generator with getRemovedFileSnapshots returning
    //     a snapshot for the old absolute path and getIndex returning entries for new path

    // Simulate the onInvalidate calls that watchStorySpecifiers would normally make
    // Wait > DEBOUNCE ms

    expect(renameRedirectStore.getState().chains).toEqual({
      'button--primary': ['button--secondary'],
    });
  });
});
```

Note: if `index-json.test.ts` does not exist, the engineer creates it following the pattern of nearby tests in `code/core/src/core-server/utils/`. The test harness wiring is non-trivial; the key guarantee to verify is the store-write timing.

- [ ] **Step 2: Run and iterate until passing**

Run: `cd code && yarn vitest run core/src/core-server/utils/index-json.test.ts`
Expected: PASS after implementation wiring is correctly mocked.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/core-server/utils/index-json.test.ts
git commit -m "test(rename-redirect): integration test for store write"
```

---

## Task 17: Manager setIndex — redirect when chain ends in a valid new ID

**Files:**
- Modify: `code/core/src/manager-api/modules/stories.ts`

- [ ] **Step 1: Read the existing setIndex implementation**

Open [code/core/src/manager-api/modules/stories.ts](code/core/src/manager-api/modules/stories.ts) and locate the `setIndex: async (input) => { ... }` block (around line 712).

- [ ] **Step 2: Add the redirect logic**

At the end of `setIndex`, after `store.setState({ ... })`, add:

```typescript
// Rename redirect: if the current story is missing from the new index,
// consult the rename store.
const { storyId: currentStoryId } = store.getState();
if (currentStoryId && !input.entries[currentStoryId]) {
  const { chains } = renameRedirectStore.getState();
  const chain = chains[currentStoryId];
  if (chain !== undefined && chain.length > 0) {
    const last = chain[chain.length - 1];
    if (last !== null && input.entries[last]) {
      api.selectStory(last);
    }
  }
}
```

Add the import at the top of the file:

```typescript
import { renameRedirectStore } from '../stores/rename-redirect.ts';
```

- [ ] **Step 3: Verify compilation**

Run: `cd code && yarn nx compile core`
Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add code/core/src/manager-api/modules/stories.ts
git commit -m "feat(rename-redirect): manager redirects to renamed story on setIndex"
```

---

## Task 18: Manager redirect — test that selectStory is called with the new ID

**Files:**
- Modify: `code/core/src/manager-api/tests/stories.test.ts`

- [ ] **Step 1: Add the test**

Locate an appropriate `describe` block for `setIndex` or `fetchIndex`. Add:

```typescript
it('redirects to the renamed story when current story is missing and chain maps to it', async () => {
  // Setup: manager has current storyId "old--x"
  // Rename store has chains: { "old--x": ["new--x"] }
  // New index has only "new--x"

  const { api, store } = initialize(/* existing helpers */);
  store.setState({ storyId: 'old--x' } as any);

  // Populate the rename store (either via direct setState or by simulating the server push)
  const { renameRedirectStore } = await import('../stores/rename-redirect.ts');
  renameRedirectStore.setState({ chains: { 'old--x': ['new--x'] } });

  const selectStorySpy = vi.spyOn(api, 'selectStory');

  await api.setIndex({
    v: 5,
    entries: {
      'new--x': { id: 'new--x', name: 'X', title: 'New', importPath: './new.ts', type: 'story' },
    },
  } as any);

  expect(selectStorySpy).toHaveBeenCalledWith('new--x');
});
```

Note: the engineer adapts to the existing `initialize()` or similar test helper in this test file.

- [ ] **Step 2: Run test**

Run: `cd code && yarn vitest run core/src/manager-api/tests/stories.test.ts -t "redirects to the renamed story"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/manager-api/tests/stories.test.ts
git commit -m "test(rename-redirect): manager redirect on setIndex"
```

---

## Task 19: Manager redirect — no-op when chain target is not in index

**Files:**
- Modify: `code/core/src/manager-api/tests/stories.test.ts`

- [ ] **Step 1: Add the test**

```typescript
it('does not redirect when chain last element is absent from the new index', async () => {
  const { api, store } = initialize();
  store.setState({ storyId: 'old--x' } as any);

  const { renameRedirectStore } = await import('../stores/rename-redirect.ts');
  renameRedirectStore.setState({ chains: { 'old--x': ['new--x'] } });

  const selectStorySpy = vi.spyOn(api, 'selectStory');

  // New index does NOT contain new--x
  await api.setIndex({ v: 5, entries: {} } as any);

  expect(selectStorySpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test**

Run: `cd code && yarn vitest run core/src/manager-api/tests/stories.test.ts -t "does not redirect when chain last element is absent"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/manager-api/tests/stories.test.ts
git commit -m "test(rename-redirect): no redirect when target missing"
```

---

## Task 20: Manager redirect — no-op when chain ends in null (deletion)

**Files:**
- Modify: `code/core/src/manager-api/tests/stories.test.ts`

- [ ] **Step 1: Add the test**

```typescript
it('does not call selectStory when chain ends in null (deletion)', async () => {
  const { api, store } = initialize();
  store.setState({ storyId: 'gone--x' } as any);

  const { renameRedirectStore } = await import('../stores/rename-redirect.ts');
  renameRedirectStore.setState({ chains: { 'gone--x': [null] } });

  const selectStorySpy = vi.spyOn(api, 'selectStory');

  await api.setIndex({ v: 5, entries: {} } as any);

  expect(selectStorySpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test**

Run: `cd code && yarn vitest run core/src/manager-api/tests/stories.test.ts -t "does not call selectStory when chain ends in null"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/manager-api/tests/stories.test.ts
git commit -m "test(rename-redirect): deletion chain does not redirect"
```

---

## Task 21: Specialised 404 UI — detection hook

**Files:**
- Modify: `code/core/src/manager/components/preview/Preview.tsx`

- [ ] **Step 1: Identify the rendering branch for "story missing"**

Open [code/core/src/manager/components/preview/Preview.tsx](code/core/src/manager/components/preview/Preview.tsx). The component uses `mapper` (line 32) to pull state; find where the UI responds to an invalid/missing story. If the missing-story rendering is delegated to a child component (e.g., `NoPreview` in Wrappers.tsx), trace to that component and augment there.

- [ ] **Step 2: Consult renameRedirectStore for the current storyId**

Add a branch that checks the rename store when rendering the missing-story UI:

```typescript
import { renameRedirectStore } from '../../../manager-api/stores/rename-redirect.ts';

// ... inside the component, when the current storyId is missing from the index:
const { chains } = renameRedirectStore.getState();
const chain = chains[currentStoryId];
const isKnownDeletion = chain !== undefined && chain[chain.length - 1] === null;
```

Render a specialised message when `isKnownDeletion`:

```tsx
{isKnownDeletion ? (
  <MissingStoryMessage title="This story was deleted." />
) : (
  <MissingStoryMessage title="Story not found." />
)}
```

Note: the exact existing component for rendering error states must be used — the engineer reads the surrounding code to find the right wrapper (e.g., `NoPreview`, `PreviewError`). If none accepts a custom message, extend it minimally with a `message` prop.

- [ ] **Step 3: Verify compilation**

Run: `cd code && yarn nx compile core`
Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add code/core/src/manager/components/preview/
git commit -m "feat(rename-redirect): specialised 404 for known deletions"
```

---

## Task 22: End-to-end smoke test via internal Storybook UI

**Files:**
- None created — this is a manual verification step.

- [ ] **Step 1: Start the internal UI**

```bash
cd code && yarn storybook:ui
```

Wait for Storybook to open in the browser.

- [ ] **Step 2: Test rename-redirect**

1. Navigate to any story.
2. In a terminal, rename the corresponding `.stories.tsx` file using `git mv` or `mv`.
3. Watch the browser. The URL should automatically update to the new story ID, and the story should render.

- [ ] **Step 3: Test deletion notice**

1. Navigate to any story.
2. Delete the corresponding `.stories.tsx` file (`git rm` or `rm`).
3. Watch the browser. A "This story was deleted." notice should appear.

- [ ] **Step 4: Test round-trip (no loop)**

1. Navigate to story `A`.
2. Rename `A` file to `B`.
3. Confirm redirect to `B`.
4. Rename `B` file back to `A`.
5. Confirm redirect to `A`. No infinite loop.

- [ ] **Step 5: Restore original files**

```bash
git checkout -- <renamed or deleted files>
```

- [ ] **Step 6: Commit no code changes — this is a smoke-test task**

(No commit needed; notes can be added to the PR description.)

---

## Task 23: Full-suite verification

**Files:**
- None modified.

- [ ] **Step 1: Run full lint and typecheck**

Run: `cd code && yarn lint && yarn nx run-many -t check`
Expected: clean exit.

- [ ] **Step 2: Run full unit test suite**

Run: `cd code && yarn test`
Expected: all tests pass.

- [ ] **Step 3: Commit any fixes**

If any pre-existing tests broke, fix them and commit. Otherwise, proceed.

```bash
git commit --allow-empty -m "chore(rename-redirect): full verification pass"
```

(Only commit the empty marker if no other commits were needed; skip if fixes were made in prior commits.)

---

## Notes for the Implementer

- **The UniversalStore API is experimental.** Test behaviour against the status-store reference pattern in `code/core/src/core-server/stores/status.ts` and `code/core/src/manager-api/stores/status.ts` if you hit issues.
- **Disambiguation is intentionally conservative.** When `resolveRenamePairs` fails, we emit nothing to the store — the user sees the existing 404 behaviour. Do not add speculative redirect logic.
- **Do not subscribe to `renameRedirectStore` in the manager.** All reads happen synchronously via `getState()` inside `setIndex()` (for redirect) or the 404 rendering path (for the deletion notice). Subscriptions reintroduce race conditions.
- **Export-name alignment, not positional.** Tasks 14 and 15 use export-name keys to build the rename pairs — this is load-bearing for the explicit-title stable-ID case (chain collapses to a no-op via the round-trip rule).

## Self-Review Notes

Spec coverage verified: rename detection (Tasks 11-12), disambiguation (Task 14), chain algorithm (Tasks 2-6), store definition (Tasks 1, 7, 8), orchestration (Tasks 13, 15, 16), manager redirect (Tasks 17-20), specialised 404 (Task 21), breaking-change preservation (no STORY_INDEX_INVALIDATED payload changes, confirmed in Task 13-15).

No placeholders in steps — all code blocks contain actual implementation. Some test scaffolding (Tasks 16, 18-20) defers to "engineer adapts to existing test harness" because the harness patterns vary per file — the engineer reads the file to match. The *assertions* (what to verify) are fully specified.

Type consistency: `renameRedirectStore` named identically everywhere. `RenameRedirectState`, `RenameRedirectChain`, `Rename` types consistent. `applyRenameChains(current, renames, deletions)` signature stable across all usages.
