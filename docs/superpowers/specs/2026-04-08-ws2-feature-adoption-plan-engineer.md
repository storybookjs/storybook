# WS2: Feature Adoption Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship per-story feature adoption data, per-file meta stats, deeper preview.ts parsing, and sanitized addon names in every `dev`/`build` telemetry event.

**Architecture:** Seven independent changes that compose into a single PR. `IndexInputStats` gains `own*`/`meta*` fields and a `complete` marker. `CsfFile.parse()` populates them by splitting the existing merged annotation check. `summarizeStats` gets coverage tracking. `summarizeIndex` gets `metaStats` for per-file meta counts deduplicated by title. `storybook-metadata.ts` gets deeper preview.ts extraction. A new `sanitize-addons.ts` module hashes community addon names at the wire layer. The spike script is deleted.

**Tech Stack:** TypeScript, Node.js, Vitest (tests)

**Design doc:** `docs/superpowers/specs/2026-04-07-telemetry-enhancements-design.md`

**PM companion:** `docs/superpowers/specs/2026-04-08-ws2-feature-adoption-plan-pm.md`

**Repo conventions:**
- Run commands from repo root unless stated otherwise
- Use `yarn` (Yarn Berry) as package manager
- Use `storybook/internal/*` import paths for core internals
- Use explicit `.ts`/`.tsx` extensions in relative imports
- Use `storybook/internal/node-logger` logger, not `console.*`
- Run `yarn lint` and `yarn --cwd code lint:js:cmd <path> --fix` for linting
- Run `yarn test` for unit tests (Vitest)

---

## Task 1: Extend `IndexInputStats` with ownership and meta fields

**Files:**
- Modify: `code/core/src/types/modules/indexer.ts`

- [ ] **Step 1: Add new fields to `IndexInputStats`**

In `code/core/src/types/modules/indexer.ts`, find the `IndexInputStats` interface (lines 90-102). The current fields are:

```ts
export interface IndexInputStats {
  loaders?: boolean;
  play?: boolean;
  tests?: boolean;
  render?: boolean;
  storyFn?: boolean;
  mount?: boolean;
  beforeEach?: boolean;
  moduleMock?: boolean;
  globals?: boolean;
  factory?: boolean;
  tags?: boolean;
}
```

Replace it with the extended version. Keep all existing fields (they remain backward-compatible for the existing merged check). Add `complete` and the new `own*`/`meta*` fields after the existing ones:

```ts
export interface IndexInputStats {
  // Existing fields (merged story+meta, kept for backward compatibility)
  loaders?: boolean;
  play?: boolean;
  tests?: boolean;
  render?: boolean;
  storyFn?: boolean;
  mount?: boolean;
  beforeEach?: boolean;
  moduleMock?: boolean;
  globals?: boolean;
  factory?: boolean;
  tags?: boolean;

  /**
   * Set to true by CsfFile when it fully populates all stats fields.
   * Third-party indexers (svelte-csf, nuxt-csf) that don't know about these
   * fields leave this undefined. Metabase queries can filter on `complete`
   * to compute accurate adoption rates.
   */
  complete?: boolean;

  // Per-story ownership fields (true when the STORY itself defines the annotation)
  ownDecorators?: boolean;
  ownLoaders?: boolean;
  ownArgTypes?: boolean;
  ownParameters?: boolean;
  ownLayout?: boolean;
  ownViewport?: boolean;
  ownGlobals?: boolean;
  ownTags?: boolean;

  // Meta-level fields (true when the META default export defines the annotation)
  metaDecorators?: boolean;
  metaLoaders?: boolean;
  metaArgTypes?: boolean;
  metaParameters?: boolean;
  metaLayout?: boolean;
  metaViewport?: boolean;
  metaGlobals?: boolean;
  metaTags?: boolean;
  metaRender?: boolean;

  // Textual scan fields
  usesActionImport?: boolean;
  usesFnImport?: boolean;
}
```

- [ ] **Step 2: Verify compilation**

Run: `yarn nx compile storybook`

Expected: No errors (all new fields are optional booleans, backward-compatible).

- [ ] **Step 3: Commit**

```bash
git add code/core/src/types/modules/indexer.ts
git commit -m "feat(telemetry): extend IndexInputStats with ownership, meta, and completeness fields"
```

---

## Task 2: Enrich `CsfFile.parse()` to populate the new stats fields

**Files:**
- Modify: `code/core/src/csf-tools/CsfFile.ts`
- Modify: `code/core/src/csf-tools/CsfFile.test.ts`

- [ ] **Step 1: Write failing tests**

In `code/core/src/csf-tools/CsfFile.test.ts`, add new test cases that verify the `__stats` fields on parsed stories. Find the existing test section that checks `__stats` (search for `__stats` in the file). Add tests like:

```ts
describe('IndexInputStats ownership fields', () => {
  it('should set ownDecorators when story has decorators', async () => {
    const csfFile = await loadCsf(
      dedent`
        import { Meta, StoryObj } from '@storybook/react';
        const meta = { title: 'Component' } satisfies Meta;
        export default meta;
        export const WithDecorators: StoryObj = {
          decorators: [(Story) => <div><Story /></div>],
        };
        export const WithoutDecorators: StoryObj = {};
      `,
      { fileName: 'test.stories.tsx' }
    );
    csfFile.parse();
    const stories = Object.values(csfFile.stories);
    const withDec = stories.find(s => s.name === 'With Decorators');
    const withoutDec = stories.find(s => s.name === 'Without Decorators');
    expect(withDec?.__stats?.ownDecorators).toBe(true);
    expect(withDec?.__stats?.complete).toBe(true);
    expect(withoutDec?.__stats?.ownDecorators).toBeFalsy();
  });

  it('should set metaDecorators when meta has decorators', async () => {
    const csfFile = await loadCsf(
      dedent`
        import { Meta, StoryObj } from '@storybook/react';
        const meta = {
          title: 'Component',
          decorators: [(Story) => <div><Story /></div>],
        } satisfies Meta;
        export default meta;
        export const Basic: StoryObj = {};
      `,
      { fileName: 'test.stories.tsx' }
    );
    csfFile.parse();
    const stories = Object.values(csfFile.stories);
    expect(stories[0]?.__stats?.metaDecorators).toBe(true);
    expect(stories[0]?.__stats?.ownDecorators).toBeFalsy();
  });

  it('should detect ownLayout from story parameters.layout', async () => {
    const csfFile = await loadCsf(
      dedent`
        import { Meta, StoryObj } from '@storybook/react';
        const meta = { title: 'Component' } satisfies Meta;
        export default meta;
        export const Centered: StoryObj = {
          parameters: { layout: 'centered' },
        };
      `,
      { fileName: 'test.stories.tsx' }
    );
    csfFile.parse();
    const stories = Object.values(csfFile.stories);
    expect(stories[0]?.__stats?.ownLayout).toBe(true);
    expect(stories[0]?.__stats?.ownParameters).toBe(true);
  });

  it('should detect usesActionImport from action() in story file imports', async () => {
    const csfFile = await loadCsf(
      dedent`
        import { Meta, StoryObj } from '@storybook/react';
        import { action } from '@storybook/addon-actions';
        const meta = { title: 'Component' } satisfies Meta;
        export default meta;
        export const WithAction: StoryObj = {
          args: { onClick: action('click') },
        };
      `,
      { fileName: 'test.stories.tsx' }
    );
    csfFile.parse();
    const stories = Object.values(csfFile.stories);
    expect(stories[0]?.__stats?.usesActionImport).toBe(true);
  });

  it('should detect usesFnImport from fn() in story file imports', async () => {
    const csfFile = await loadCsf(
      dedent`
        import { Meta, StoryObj } from '@storybook/react';
        import { fn } from '@storybook/test';
        const meta = { title: 'Component' } satisfies Meta;
        export default meta;
        export const WithFn: StoryObj = {
          args: { onClick: fn() },
        };
      `,
      { fileName: 'test.stories.tsx' }
    );
    csfFile.parse();
    const stories = Object.values(csfFile.stories);
    expect(stories[0]?.__stats?.usesFnImport).toBe(true);
  });
});
```

Note: Adapt the test structure to match the existing test patterns in the file. Use `loadCsf` and `csfFile.parse()` as the existing tests do. The exact import pattern may need adjustment — check how `loadCsf` is used in the existing tests.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn vitest run code/core/src/csf-tools/CsfFile.test.ts --reporter=verbose 2>&1 | tail -30`

Expected: The new tests fail because the `__stats` fields don't yet include `ownDecorators`, `metaDecorators`, `complete`, etc.

- [ ] **Step 3: Modify the initial `__stats` object**

In `code/core/src/csf-tools/CsfFile.ts`, find the initial `__stats` object at line 676:

```ts
self._stories[exportName] = {
  id: 'FIXME',
  name,
  parameters,
  __stats: {
    factory: storyIsFactory,
  },
};
```

Leave this unchanged — the initial `__stats` only needs `factory`. All other fields will be populated in the post-processing loop.

- [ ] **Step 4: Modify the post-processing enrichment loop**

In `code/core/src/csf-tools/CsfFile.ts`, find the post-processing loop at lines 927-949. The current code is:

```ts
const stats = acc[key].__stats;
['play', 'render', 'loaders', 'beforeEach', 'globals', 'tags'].forEach((annotation) => {
  stats[annotation as keyof IndexInputStats] =
    !!storyAnnotations[annotation] || !!self._metaAnnotations[annotation];
});
const storyExport = self.getStoryExport(key);
stats.storyFn = !!(
  t.isArrowFunctionExpression(storyExport) || t.isFunctionDeclaration(storyExport)
);
stats.mount = hasMount(storyAnnotations.play ?? self._metaAnnotations.play);
stats.moduleMock = !!self.imports.find((fname) => isModuleMock(fname));
```

Replace the section starting at `const stats = acc[key].__stats;` through `stats.moduleMock = ...` with:

```ts
const stats = acc[key].__stats;

// Existing merged fields (backward-compatible: true if story OR meta has it)
['play', 'render', 'loaders', 'beforeEach', 'globals', 'tags'].forEach((annotation) => {
  stats[annotation as keyof IndexInputStats] =
    !!storyAnnotations[annotation] || !!self._metaAnnotations[annotation];
});
const storyExport = self.getStoryExport(key);
stats.storyFn = !!(
  t.isArrowFunctionExpression(storyExport) || t.isFunctionDeclaration(storyExport)
);
stats.mount = hasMount(storyAnnotations.play ?? self._metaAnnotations.play);
stats.moduleMock = !!self.imports.find((fname) => isModuleMock(fname));

// === New: per-story ownership fields ===
stats.ownDecorators = !!storyAnnotations.decorators;
stats.ownLoaders = !!storyAnnotations.loaders;
stats.ownArgTypes = !!storyAnnotations.argTypes;
stats.ownTags = !!storyAnnotations.tags;
stats.ownGlobals = !!storyAnnotations.globals;

// Check story-level parameters sub-keys
const storyParams = storyAnnotations.parameters;
stats.ownParameters = !!storyParams;
if (storyParams && t.isObjectExpression(storyParams)) {
  stats.ownLayout = storyParams.properties.some(
    (p) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'layout' })
  );
  stats.ownViewport = storyParams.properties.some(
    (p) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'viewport' })
  );
}

// === New: meta-level fields ===
stats.metaDecorators = !!self._metaAnnotations.decorators;
stats.metaLoaders = !!self._metaAnnotations.loaders;
stats.metaArgTypes = !!self._metaAnnotations.argTypes;
stats.metaTags = !!self._metaAnnotations.tags;
stats.metaGlobals = !!self._metaAnnotations.globals;
stats.metaRender = !!self._metaAnnotations.render;

// Check meta-level parameters sub-keys
const metaParams = self._metaAnnotations.parameters;
stats.metaParameters = !!metaParams;
if (metaParams && t.isObjectExpression(metaParams)) {
  stats.metaLayout = metaParams.properties.some(
    (p) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'layout' })
  );
  stats.metaViewport = metaParams.properties.some(
    (p) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'viewport' })
  );
}

// === New: textual scan fields ===
// Detect `action` import from '@storybook/addon-actions'
stats.usesActionImport = self.imports.some(
  (fname) => fname === '@storybook/addon-actions'
);
// Detect `fn` import from '@storybook/test' (or 'storybook/test')
stats.usesFnImport = self.imports.some(
  (fname) => fname === '@storybook/test' || fname === 'storybook/test'
);

// Mark this entry as fully populated by CsfFile
stats.complete = true;
```

**Important implementation notes:**
- `self._metaAnnotations` is populated earlier in `parse()` when the default export is processed. It contains the AST nodes for each annotation key on the meta object.
- `storyAnnotations` comes from `self._storyAnnotations[key]` (line 916).
- `self.imports` is an array of import source strings populated during AST traversal. Check the exact field name by searching for `this.imports` or `self.imports` in the file.
- For `parameters` sub-key detection: The `storyAnnotations.parameters` may be an identifier (variable reference) rather than an object expression. Only drill into it when it's an `ObjectExpression`. When it's a variable reference or spread, we can't statically determine sub-keys — leave `ownLayout`/`ownViewport` as undefined (falsy).
- `usesActionImport` and `usesFnImport` are per-file, not per-story. They'll be the same for all stories in a file. This is acceptable — Metabase can deduplicate by file.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn vitest run code/core/src/csf-tools/CsfFile.test.ts --reporter=verbose 2>&1 | tail -30`

Expected: All tests pass including the new ones.

- [ ] **Step 6: Verify compilation**

Run: `yarn nx compile storybook`

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add code/core/src/csf-tools/CsfFile.ts code/core/src/csf-tools/CsfFile.test.ts
git commit -m "feat(csf-tools): populate own/meta stats fields and textual scan in CsfFile.parse()"
```

---

## Task 3: Expand `summarizeStats` with coverage tracking

**Files:**
- Modify: `code/core/src/core-server/utils/summarizeStats.ts`
- Modify: `code/core/src/core-server/utils/summarizeStats.test.ts`

- [ ] **Step 1: Write failing tests**

In `code/core/src/core-server/utils/summarizeStats.test.ts`, add new tests:

```ts
it('should track storiesTotal and storiesWithCompleteStats', () => {
  const stats = [
    { play: true, complete: true, ownDecorators: true },
    { play: true, complete: true, ownDecorators: false },
    { play: false }, // third-party indexer entry, no complete flag
  ];
  const result = summarizeStats(stats);
  expect(result.storiesTotal).toBe(3);
  expect(result.storiesWithCompleteStats).toBe(2);
  expect(result.play).toBe(2);
  expect(result.ownDecorators).toBe(1);
});

it('should only count own/meta fields for complete entries', () => {
  const stats = [
    { complete: true, ownDecorators: true, metaDecorators: true },
    { ownDecorators: true, metaDecorators: true }, // not complete — should NOT count own/meta
  ];
  const result = summarizeStats(stats);
  expect(result.ownDecorators).toBe(1);
  expect(result.metaDecorators).toBe(1);
  expect(result.storiesWithCompleteStats).toBe(1);
  expect(result.storiesTotal).toBe(2);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn vitest run code/core/src/core-server/utils/summarizeStats.test.ts --reporter=verbose 2>&1 | tail -30`

Expected: Fails because `storiesTotal` and `storiesWithCompleteStats` don't exist.

- [ ] **Step 3: Implement the changes**

Replace the entire contents of `code/core/src/core-server/utils/summarizeStats.ts` with:

```ts
import type { IndexInputStats } from 'storybook/internal/types';

export type IndexStatsSummary = Record<keyof IndexInputStats, number> & {
  storiesTotal: number;
  storiesWithCompleteStats: number;
};

/** Fields that should only be counted when `complete` is true. */
const COMPLETE_ONLY_FIELDS = new Set<string>([
  'ownDecorators',
  'ownLoaders',
  'ownArgTypes',
  'ownParameters',
  'ownLayout',
  'ownViewport',
  'ownGlobals',
  'ownTags',
  'metaDecorators',
  'metaLoaders',
  'metaArgTypes',
  'metaParameters',
  'metaLayout',
  'metaViewport',
  'metaGlobals',
  'metaTags',
  'metaRender',
  'usesActionImport',
  'usesFnImport',
]);

export const addStats = (stat: IndexInputStats, acc: IndexStatsSummary) => {
  const isComplete = !!stat.complete;

  Object.entries(stat).forEach(([key, value]) => {
    // Skip complete field itself — tracked separately
    if (key === 'complete') {
      return;
    }

    const statsKey = key as keyof IndexInputStats;

    // Only count own*/meta*/textual-scan fields when the entry is complete
    if (COMPLETE_ONLY_FIELDS.has(key) && !isComplete) {
      return;
    }

    if (!acc[statsKey]) {
      acc[statsKey] = 0;
    }
    acc[statsKey] += value ? 1 : 0;
  });
};

export const summarizeStats = (stats: IndexInputStats[]): IndexStatsSummary => {
  const acc = {
    storiesTotal: 0,
    storiesWithCompleteStats: 0,
  } as IndexStatsSummary;

  return stats.reduce((result, stat) => {
    result.storiesTotal += 1;
    if (stat.complete) {
      result.storiesWithCompleteStats += 1;
    }
    addStats(stat, result);
    return result;
  }, acc);
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn vitest run code/core/src/core-server/utils/summarizeStats.test.ts --reporter=verbose 2>&1 | tail -30`

Expected: All tests pass. **Note**: The existing inline snapshot test will need updating because `summarizeStats` now returns `storiesTotal` and `storiesWithCompleteStats` fields. Update the inline snapshot to include those.

- [ ] **Step 5: Verify compilation**

Run: `yarn nx compile storybook`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add code/core/src/core-server/utils/summarizeStats.ts code/core/src/core-server/utils/summarizeStats.test.ts
git commit -m "feat(telemetry): add coverage tracking to summarizeStats for complete-only fields"
```

---

## Task 4: Add `metaStats` to `summarizeIndex`

**Files:**
- Modify: `code/core/src/core-server/utils/summarizeIndex.ts`
- Modify: `code/core/src/core-server/utils/summarizeIndex.test.ts`

- [ ] **Step 1: Write failing tests**

In `code/core/src/core-server/utils/summarizeIndex.test.ts`, add a new test case:

```ts
it('metaStats deduplicates by component title', () => {
  const result = summarizeIndex({
    v: 5,
    entries: {
      'component-a--story1': {
        id: 'component-a--story1',
        title: 'ComponentA',
        name: 'Story1',
        importPath: './src/ComponentA.stories.tsx',
        tags: ['story'],
        type: 'story',
        subtype: 'story',
        __stats: {
          complete: true,
          metaDecorators: true,
          metaLoaders: true,
          ownDecorators: true,
        },
      } as any,
      'component-a--story2': {
        id: 'component-a--story2',
        title: 'ComponentA',
        name: 'Story2',
        importPath: './src/ComponentA.stories.tsx',
        tags: ['story'],
        type: 'story',
        subtype: 'story',
        __stats: {
          complete: true,
          metaDecorators: true,
          metaLoaders: true,
        },
      } as any,
      'component-b--story1': {
        id: 'component-b--story1',
        title: 'ComponentB',
        name: 'Story1',
        importPath: './src/ComponentB.stories.tsx',
        tags: ['story'],
        type: 'story',
        subtype: 'story',
        __stats: {
          complete: true,
          metaDecorators: false,
          metaLoaders: true,
        },
      } as any,
    },
  });
  // ComponentA has metaDecorators (1 file), ComponentB does not (0)
  expect(result.metaStats?.filesWithMetaDecorators).toBe(1);
  // Both ComponentA and ComponentB have metaLoaders
  expect(result.metaStats?.filesWithMetaLoaders).toBe(2);
  expect(result.metaStats?.filesTotal).toBe(2);
});
```

Note: The `as any` cast is needed because `StoryIndexEntry` doesn't have `__stats` on the entry type — it's on `BaseIndexInput`, not `IndexEntry`. You may need to extend the type or cast. Check how `__stats` flows through to entries at runtime.

**Important**: `__stats` is on `BaseIndexInput` (the indexer input), not on `IndexEntry` (the stored entry). When the story index is built, `__stats` is preserved through to the final entries. Verify this by checking the `StoryIndexGenerator` code. If `__stats` is NOT on `IndexEntry`, you'll need to add it — add `__stats?: IndexInputStats` to `BaseIndexEntry` in `code/core/src/types/modules/indexer.ts` (around line 68).

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn vitest run code/core/src/core-server/utils/summarizeIndex.test.ts --reporter=verbose 2>&1 | tail -30`

Expected: Fails because `metaStats` doesn't exist on the return value.

- [ ] **Step 3: Add `__stats` to `BaseIndexEntry` if needed**

Check if `__stats` is available on `IndexEntry` at runtime. If not, in `code/core/src/types/modules/indexer.ts`, add to `BaseIndexEntry` (around line 68):

```ts
type BaseIndexEntry = {
  id: StoryId;
  // ... existing fields ...
  __stats?: IndexInputStats;
};
```

This may already flow through — verify by checking `StoryIndexGenerator.ts` to see if `__stats` from `BaseIndexInput` is copied to the entry.

- [ ] **Step 4: Implement `metaStats` in `summarizeIndex`**

In `code/core/src/core-server/utils/summarizeIndex.ts`, add the meta stats tracking. Import `IndexInputStats` if needed:

```ts
import type { IndexEntry, IndexInputStats, StoryIndex } from 'storybook/internal/types';
```

Add tracking variables after the existing counters (after line 42):

```ts
// Meta stats: track which titles (files) have each meta-level feature
const metaDecoratorsTitles = new Set<string>();
const metaLoadersTitles = new Set<string>();
const metaArgTypesTitles = new Set<string>();
const metaParametersTitles = new Set<string>();
const metaLayoutTitles = new Set<string>();
const metaViewportTitles = new Set<string>();
const metaGlobalsTitles = new Set<string>();
const metaTagsTitles = new Set<string>();
const metaRenderTitles = new Set<string>();
const completeTitles = new Set<string>();
```

Inside the existing `else if (entry.type === 'story')` block (around line 60-77), after `storyCount += 1;`, add:

```ts
      // Track meta stats deduplicated by component title
      const stats = (entry as any).__stats as IndexInputStats | undefined;
      if (stats?.complete) {
        completeTitles.add(entry.title);
        if (stats.metaDecorators) metaDecoratorsTitles.add(entry.title);
        if (stats.metaLoaders) metaLoadersTitles.add(entry.title);
        if (stats.metaArgTypes) metaArgTypesTitles.add(entry.title);
        if (stats.metaParameters) metaParametersTitles.add(entry.title);
        if (stats.metaLayout) metaLayoutTitles.add(entry.title);
        if (stats.metaViewport) metaViewportTitles.add(entry.title);
        if (stats.metaGlobals) metaGlobalsTitles.add(entry.title);
        if (stats.metaTags) metaTagsTitles.add(entry.title);
        if (stats.metaRender) metaRenderTitles.add(entry.title);
      }
```

Add the `metaStats` object to the return value (after line 113):

```ts
    metaStats: {
      filesTotal: completeTitles.size,
      filesWithMetaDecorators: metaDecoratorsTitles.size,
      filesWithMetaLoaders: metaLoadersTitles.size,
      filesWithMetaArgTypes: metaArgTypesTitles.size,
      filesWithMetaParameters: metaParametersTitles.size,
      filesWithMetaLayout: metaLayoutTitles.size,
      filesWithMetaViewport: metaViewportTitles.size,
      filesWithMetaGlobals: metaGlobalsTitles.size,
      filesWithMetaTags: metaTagsTitles.size,
      filesWithMetaRender: metaRenderTitles.size,
    },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn vitest run code/core/src/core-server/utils/summarizeIndex.test.ts --reporter=verbose 2>&1 | tail -30`

Expected: All tests pass. **Note**: Existing inline snapshots will need updating to include the new `metaStats` field (all zeros for entries without `__stats`).

- [ ] **Step 6: Verify compilation**

Run: `yarn nx compile storybook`

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add code/core/src/core-server/utils/summarizeIndex.ts code/core/src/core-server/utils/summarizeIndex.test.ts code/core/src/types/modules/indexer.ts
git commit -m "feat(telemetry): add metaStats to summarizeIndex for per-file meta feature tracking"
```

---

## Task 5: Deeper preview.ts parsing in `storybook-metadata.ts`

**Files:**
- Modify: `code/core/src/telemetry/storybook-metadata.ts`
- Modify: `code/core/src/telemetry/storybook-metadata.test.ts`

- [ ] **Step 1: Write failing tests**

In `code/core/src/telemetry/storybook-metadata.test.ts`, add new test cases for the expanded preview extraction. Find the existing test section that tests `metadata.preview.usesGlobals` and add alongside it:

```ts
it('should detect decorators in preview config', async () => {
  // Mock the preview config to contain decorators
  // This test needs to set up a mock preview file with decorators.
  // Adapt the existing test pattern for usesGlobals.
  // The key is that readConfig returns a ConfigFile object with
  // getFieldNode(['decorators']) returning a node.
  // ... adapt based on existing test patterns in the file
});

it('should detect parameters.layout in preview config', async () => {
  // ... similar to above, with parameters containing layout key
});

it('should count decorators array length', async () => {
  // ... verify decoratorCount matches array length
});
```

**Note**: The exact test structure depends on how the existing `usesGlobals` tests are written. Look at the existing preview config tests and follow the same mocking pattern for `readConfig`.

- [ ] **Step 2: Implement the expanded preview extraction**

In `code/core/src/telemetry/storybook-metadata.ts`, find the preview extraction block (lines 247-258):

```ts
try {
  const { previewConfigPath: previewConfig } = storybookInfo;
  if (previewConfig) {
    const config = await readConfig(previewConfig);
    const usesGlobals = !!(
      config.getFieldNode(['globals']) || config.getFieldNode(['globalTypes'])
    );
    metadata.preview = { ...metadata.preview, usesGlobals };
  }
} catch (e) {
  // gracefully handle error, as it's not critical information and AST parsing can cause trouble
}
```

Replace it with the expanded version:

```ts
try {
  const { previewConfigPath: previewConfig } = storybookInfo;
  if (previewConfig) {
    const config = await readConfig(previewConfig);
    const usesGlobals = !!(
      config.getFieldNode(['globals']) || config.getFieldNode(['globalTypes'])
    );

    // Decorators
    const decoratorsNode = config.getFieldNode(['decorators']);
    const hasDecorators = !!decoratorsNode;
    let decoratorCount: number | undefined;
    if (decoratorsNode && t.isArrayExpression(decoratorsNode)) {
      decoratorCount = decoratorsNode.elements.length;
    }

    // Loaders
    const loadersNode = config.getFieldNode(['loaders']);
    const hasLoaders = !!loadersNode;
    let loaderCount: number | undefined;
    if (loadersNode && t.isArrayExpression(loadersNode)) {
      loaderCount = loadersNode.elements.length;
    }

    // Parameters and sub-keys
    const parametersNode = config.getFieldNode(['parameters']);
    const hasParameters = !!parametersNode;
    let hasLayout: boolean | undefined;
    let hasViewport: boolean | undefined;
    if (parametersNode && t.isObjectExpression(parametersNode)) {
      hasLayout = parametersNode.properties.some(
        (p) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'layout' })
      );
      hasViewport = parametersNode.properties.some(
        (p) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'viewport' })
      );
    }

    // ArgTypes
    const argTypesNode = config.getFieldNode(['argTypes']);
    const hasArgTypes = !!argTypesNode;
    let argTypesCount: number | undefined;
    if (argTypesNode && t.isObjectExpression(argTypesNode)) {
      argTypesCount = argTypesNode.properties.length;
    }

    // Tags
    const hasTags = !!config.getFieldNode(['tags']);

    // beforeAll
    const hasBeforeAll = !!config.getFieldNode(['beforeAll']);

    // initialGlobals (CSF factory)
    const hasInitialGlobals = !!config.getFieldNode(['initialGlobals']);

    metadata.preview = {
      ...metadata.preview,
      usesGlobals,
      hasDecorators,
      decoratorCount,
      hasLoaders,
      loaderCount,
      hasParameters,
      hasLayout,
      hasViewport,
      hasArgTypes,
      argTypesCount,
      hasTags,
      hasBeforeAll,
      hasInitialGlobals,
    };
  }
} catch (e) {
  // gracefully handle error, as it's not critical information and AST parsing can cause trouble
}
```

You'll need to add the `t` import for babel types at the top of the file if it's not already imported:

```ts
import * as t from '@babel/types';
```

Check if `@babel/types` is already imported — it likely is since `readConfig` returns AST nodes.

**Note**: `config.getFieldNode(path)` returns the AST node for the field at the given path, or `undefined` if not found. It resolves through the export chain (default export, named export, etc.). The `t.isArrayExpression` / `t.isObjectExpression` checks are needed because the node could be a variable reference that we can't statically analyze.

- [ ] **Step 3: Run the tests**

Run: `yarn vitest run code/core/src/telemetry/storybook-metadata.test.ts --reporter=verbose 2>&1 | tail -30`

Expected: All tests pass.

- [ ] **Step 4: Verify compilation**

Run: `yarn nx compile storybook`

Expected: No errors. If there's a type error because `metadata.preview` doesn't have the new fields, you'll need to update the preview type in the metadata types. Search for where `preview` is typed (likely in `code/core/src/telemetry/types.ts` or `storybook-metadata.ts`) and add the new fields.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/telemetry/storybook-metadata.ts code/core/src/telemetry/storybook-metadata.test.ts
git commit -m "feat(telemetry): extract decorators, loaders, parameters, tags from preview config"
```

---

## Task 6: Addon sanitization at the wire layer

**Files:**
- Create: `code/core/src/telemetry/addon-keyword-buckets.ts`
- Create: `code/core/src/telemetry/sanitize-addons.ts`
- Create: `code/core/src/telemetry/sanitize-addons.test.ts`
- Modify: `code/core/src/telemetry/index.ts`

- [ ] **Step 1: Create the keyword allowlist**

Create `code/core/src/telemetry/addon-keyword-buckets.ts`:

```ts
/**
 * Fixed allowlist of keyword categories for community addon bucketing.
 * Only keywords from community addon package.json that match this list
 * are included in `addonCategories`. Extend this list as new meaningful
 * categories emerge.
 */
export const ADDON_KEYWORD_BUCKETS = [
  'code',
  'data',
  'state',
  'test',
  'style',
  'design',
  'appearance',
  'organize',
  'mocking',
] as const;

export type AddonKeywordBucket = (typeof ADDON_KEYWORD_BUCKETS)[number];
```

- [ ] **Step 2: Create the sanitizer module**

Create `code/core/src/telemetry/sanitize-addons.ts`:

```ts
import { isCorePackage, isSatelliteAddon } from 'storybook/internal/common';

import { ADDON_KEYWORD_BUCKETS } from './addon-keyword-buckets.ts';
import { oneWayHash } from './one-way-hash.ts';

/**
 * Determine whether an addon is first-party (core or satellite).
 * First-party addon names are safe to send in telemetry.
 */
function isFirstPartyAddon(name: string): boolean {
  return isCorePackage(name) || isSatelliteAddon(name);
}

/**
 * Sanitize an addon name for telemetry transmission.
 * First-party addons keep their name. Community addons get hashed.
 */
function sanitizeAddonName(name: string): string {
  if (isFirstPartyAddon(name)) {
    return name;
  }
  return `hashed:${oneWayHash(name).slice(0, 16)}`;
}

/**
 * Read keywords from an addon's package.json and bucket them.
 * Returns only keywords that match the allowlist.
 */
async function getAddonKeywords(addonName: string): Promise<string[]> {
  if (isFirstPartyAddon(addonName)) {
    return [];
  }

  try {
    // Resolve the addon's package.json from node_modules
    const { getActualPackageJson } = await import('storybook/internal/common');
    const packageJson = await getActualPackageJson(addonName);
    const keywords: string[] = packageJson?.keywords ?? [];

    return keywords.filter((kw) =>
      (ADDON_KEYWORD_BUCKETS as readonly string[]).includes(kw.toLowerCase())
    );
  } catch {
    // Addon not resolvable — skip keywords
    return [];
  }
}

export interface SanitizedAddonData {
  /** Addon names with community addons hashed */
  addons: Array<{ name: string; version?: string }>;
  /** Aggregated keyword buckets from community addons */
  addonCategories: Record<string, number>;
}

/**
 * Sanitize addon names and compute keyword categories for telemetry.
 * First-party addons keep their names. Community addons are hashed.
 * Keyword categories are aggregated from community addon package.json files.
 *
 * @param addons - The raw addon list from metadata
 * @returns Sanitized addon list and aggregated category counts
 */
export async function sanitizeAddonsForWire(
  addons: Record<string, { name: string; version?: string }>
): Promise<SanitizedAddonData> {
  const sanitizedAddons: Array<{ name: string; version?: string }> = [];
  const categories: Record<string, number> = {};

  const entries = Object.values(addons);

  await Promise.all(
    entries.map(async (addon) => {
      const sanitizedName = sanitizeAddonName(addon.name);
      sanitizedAddons.push({
        name: sanitizedName,
        version: isFirstPartyAddon(addon.name) ? addon.version : undefined,
      });

      // Collect keyword categories for community addons
      const keywords = await getAddonKeywords(addon.name);
      for (const kw of keywords) {
        const lower = kw.toLowerCase();
        categories[lower] = (categories[lower] ?? 0) + 1;
      }
    })
  );

  return { addons: sanitizedAddons, addonCategories: categories };
}
```

**Implementation notes:**
- `isCorePackage` is imported from `storybook/internal/common` (defined at `code/core/src/common/utils/cli.ts:141`). It checks against the `storybookPackagesVersions` map.
- `isSatelliteAddon` is also from `storybook/internal/common` (defined at `code/core/src/common/utils/cli.ts:143`). It checks the `satellite-addons.ts` list.
- `getActualPackageJson` is dynamically imported to avoid circular dependencies at module load. It's available from `storybook/internal/common`. Verify the exact function name — it may be `getActualPackageJson` or `readPackageJson`. Search the codebase:
  ```bash
  grep -r "getActualPackageJson\|readPackageJson" code/core/src/common/ --include="*.ts" -l
  ```
- The `addons` parameter shape matches what `getStorybookMetadata` returns in `metadata.addons`. Check the actual shape in `storybook-metadata.ts` to confirm it's `Record<string, { name: string; version?: string }>`.

- [ ] **Step 3: Write tests for the sanitizer**

Create `code/core/src/telemetry/sanitize-addons.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { sanitizeAddonsForWire } from './sanitize-addons.ts';

vi.mock('storybook/internal/common', () => ({
  isCorePackage: (name: string) => name.startsWith('@storybook/'),
  isSatelliteAddon: (name: string) => name === '@chromatic-com/storybook',
  getActualPackageJson: vi.fn().mockResolvedValue({ keywords: ['test', 'style', 'irrelevant'] }),
}));

describe('sanitizeAddonsForWire', () => {
  it('should keep first-party addon names', async () => {
    const result = await sanitizeAddonsForWire({
      '@storybook/addon-essentials': {
        name: '@storybook/addon-essentials',
        version: '9.0.0',
      },
    });
    expect(result.addons[0].name).toBe('@storybook/addon-essentials');
    expect(result.addons[0].version).toBe('9.0.0');
  });

  it('should keep satellite addon names', async () => {
    const result = await sanitizeAddonsForWire({
      '@chromatic-com/storybook': {
        name: '@chromatic-com/storybook',
        version: '1.0.0',
      },
    });
    expect(result.addons[0].name).toBe('@chromatic-com/storybook');
  });

  it('should hash community addon names', async () => {
    const result = await sanitizeAddonsForWire({
      'my-custom-addon': {
        name: 'my-custom-addon',
        version: '2.0.0',
      },
    });
    expect(result.addons[0].name).toMatch(/^hashed:/);
    expect(result.addons[0].name).not.toContain('my-custom-addon');
    // Version should be stripped for community addons
    expect(result.addons[0].version).toBeUndefined();
  });

  it('should produce deterministic hashes', async () => {
    const result1 = await sanitizeAddonsForWire({
      'my-addon': { name: 'my-addon' },
    });
    const result2 = await sanitizeAddonsForWire({
      'my-addon': { name: 'my-addon' },
    });
    expect(result1.addons[0].name).toBe(result2.addons[0].name);
  });

  it('should bucket matching keywords from community addons', async () => {
    const result = await sanitizeAddonsForWire({
      'community-addon': { name: 'community-addon' },
    });
    // Mock returns ['test', 'style', 'irrelevant']
    // Only 'test' and 'style' match the allowlist
    expect(result.addonCategories.test).toBe(1);
    expect(result.addonCategories.style).toBe(1);
    expect(result.addonCategories.irrelevant).toBeUndefined();
  });

  it('should not collect keywords for first-party addons', async () => {
    const result = await sanitizeAddonsForWire({
      '@storybook/addon-essentials': {
        name: '@storybook/addon-essentials',
        version: '9.0.0',
      },
    });
    expect(Object.keys(result.addonCategories)).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `yarn vitest run code/core/src/telemetry/sanitize-addons.test.ts --reporter=verbose 2>&1 | tail -30`

Expected: All tests pass.

- [ ] **Step 5: Hook the sanitizer into the telemetry pipeline**

In `code/core/src/telemetry/index.ts`, add the sanitizer call between building `telemetryData` and sending it. Find the section around lines 60-74:

```ts
  } finally {
    const { error } = payload;
    // make sure to anonymise possible paths from error messages

    // make sure to anonymise possible paths from error messages
    if (error) {
      payload.error = sanitizeError(error);
    }

    if (!payload.error || options?.enableCrashReports) {
      if (process.env?.STORYBOOK_TELEMETRY_DEBUG) {
        logger.info('[telemetry]');
        logger.info(JSON.stringify(telemetryData, null, 2));
      }
      await sendTelemetry(telemetryData, options);
    }
  }
```

Add the sanitizer import at the top of the file:

```ts
import { sanitizeAddonsForWire } from './sanitize-addons.ts';
```

Add the sanitizer call inside the `finally` block, before `sendTelemetry`, after the error sanitization:

```ts
    // Sanitize addon names before sending
    if (telemetryData.metadata?.addons) {
      try {
        const { addons, addonCategories } = await sanitizeAddonsForWire(
          telemetryData.metadata.addons
        );
        telemetryData.metadata.addons = addons as any;
        telemetryData.metadata.addonCategories = addonCategories;
      } catch {
        // Best-effort sanitization — don't block telemetry send
      }
    }
```

**Note**: The `as any` cast may be needed if the addons type shape differs between the input (Record) and output (Array). Check the actual types. The `addonCategories` field needs to be added to the metadata type if it doesn't exist yet — find the `StorybookMetadata` type (likely in `types.ts`) and add:

```ts
addonCategories?: Record<string, number>;
```

- [ ] **Step 6: Verify compilation**

Run: `yarn nx compile storybook`

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add code/core/src/telemetry/addon-keyword-buckets.ts code/core/src/telemetry/sanitize-addons.ts code/core/src/telemetry/sanitize-addons.test.ts code/core/src/telemetry/index.ts
git commit -m "feat(telemetry): sanitize community addon names and add keyword category bucketing"
```

---

## Task 7: Delete the spike script

**Files:**
- Delete: `scripts/spike-extract-features.ts`

- [ ] **Step 1: Delete the file**

```bash
git rm scripts/spike-extract-features.ts
```

- [ ] **Step 2: Verify no references remain**

Search for any references to the spike script:

```bash
grep -r "spike-extract-features" . --include="*.ts" --include="*.md" --include="*.json" -l
```

If found in any docs or config, remove the references.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: delete spike-extract-features.ts (served its purpose)"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run full compilation**

Run: `yarn nx run-many -t compile`

Expected: All packages compile successfully.

- [ ] **Step 2: Run type checks**

Run: `yarn nx run-many -t check`

Expected: No type errors.

- [ ] **Step 3: Run unit tests for modified files**

Run:
```bash
yarn vitest run code/core/src/csf-tools/CsfFile.test.ts code/core/src/core-server/utils/summarizeStats.test.ts code/core/src/core-server/utils/summarizeIndex.test.ts code/core/src/telemetry/storybook-metadata.test.ts code/core/src/telemetry/sanitize-addons.test.ts --reporter=verbose
```

Expected: All tests pass.

- [ ] **Step 4: Run broader test suite**

Run: `yarn test`

Expected: No regressions.

- [ ] **Step 5: Lint changed files**

Run the linter on all changed files:
```bash
yarn --cwd code lint:js:cmd src/types/modules/indexer.ts --fix
yarn --cwd code lint:js:cmd src/csf-tools/CsfFile.ts --fix
yarn --cwd code lint:js:cmd src/core-server/utils/summarizeStats.ts --fix
yarn --cwd code lint:js:cmd src/core-server/utils/summarizeIndex.ts --fix
yarn --cwd code lint:js:cmd src/telemetry/storybook-metadata.ts --fix
yarn --cwd code lint:js:cmd src/telemetry/sanitize-addons.ts --fix
yarn --cwd code lint:js:cmd src/telemetry/addon-keyword-buckets.ts --fix
yarn --cwd code lint:js:cmd src/telemetry/index.ts --fix
```

Expected: No unfixable lint errors.

- [ ] **Step 6: Final commit if lint made changes**

```bash
git add -A
git status
# If there are lint-fixed changes:
git commit -m "chore: lint fixes"
```
