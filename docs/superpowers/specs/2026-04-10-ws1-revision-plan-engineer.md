# WS1 PR #34510 Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revise WS1 agentic telemetry code per PR #34510 review feedback — reorganize evidence collection, fix naming, add tests, implement AI story scoring, and clean up dead code.

**Architecture:** Evidence collection moves from `withTelemetry.ts` to a dedicated `ai-prepare-evidence.ts` module in the telemetry folder. Evidence fires from two call sites: `doTelemetry` (for dev/build, with story index) and `withTelemetry` (for all other commands, without story index). AI-written story scoring piggybacks on the ghost stories channel as a separate `ai-prepare-story-scoring` event.

**Tech Stack:** TypeScript, Vitest, Storybook telemetry pipeline, FileSystemCache, `storybook/internal/telemetry` and `storybook/internal/common` modules.

**Branch:** `sidnioulz/agentic-telemetry-ws1`

**Design doc:** `docs/superpowers/specs/2026-04-07-telemetry-enhancements-design.md` Section 9

**Circular dependency note:** `ai-prepare-evidence.ts` imports `telemetry()` from `./index.ts`, and `index.ts` re-exports from `ai-prepare-evidence.ts`. This circular import is safe because all usages of `telemetry()` inside `ai-prepare-evidence.ts` are lazy (inside function bodies, not at module top level). `event-cache.ts` uses a `type`-only import from `ai-prepare-evidence.ts` (no runtime cycle).

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `code/core/src/telemetry/ai-prepare-evidence.ts` | Evidence collection logic, story counting, preview change detection, `AiSetupPendingRecord` type, `isStoryCreatedByAISetup`, `AI_STORY_TITLE_PREFIX` |
| Create | `code/core/src/telemetry/ai-prepare-evidence.test.ts` | 10 unit tests for evidence module |
| Modify | `code/core/src/telemetry/types.ts:49` | Rename `ai-setup-evidence` → `ai-prepare-evidence`, add `ai-prepare-story-scoring` |
| Modify | `code/core/src/telemetry/event-cache.ts:85-93` | Replace `AiSetupPendingRecord` definition with type import from evidence module |
| Modify | `code/core/src/core-server/withTelemetry.ts` | Remove moved code (lines 174-266), update import, remove `.catch`, fix comments |
| Modify | `code/core/src/core-server/withTelemetry.test.ts:12-14` | Remove dead `detect-agent` mock |
| Modify | `code/core/src/core-server/utils/doTelemetry.ts` | Call evidence collection with story index |
| Modify | `code/lib/cli-storybook/src/ai/setup-requirements.ts` | Remove moved code, re-export from telemetry module |
| Modify | `code/core/src/telemetry/storybook-metadata.test.ts:569` | Fix test name |
| Modify | `code/core/src/core-server/server-channel/ghost-stories-channel.ts` | Add AI story scoring + CPU capacity check + story index param |
| Modify | `code/core/src/core-server/presets/common-preset.ts:283` | Pass story index generator to ghost stories channel |

---

### Task 1: Rename event type and add new event type

**Files:**
- Modify: `code/core/src/telemetry/types.ts:49`

- [ ] **Step 1: Update the EventType union**

In `code/core/src/telemetry/types.ts`, replace line 49:

```ts
// Before:
  | 'ai-setup-evidence';

// After:
  | 'ai-prepare-evidence'
  | 'ai-prepare-story-scoring';
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit -p code/core/tsconfig.json 2>&1 | head -20`

Expected: No new errors from this change (any existing errors are pre-existing).

- [ ] **Step 3: Commit**

```bash
git add code/core/src/telemetry/types.ts
git commit -m "refactor: rename ai-setup-evidence to ai-prepare-evidence, add ai-prepare-story-scoring event type"
```

---

### Task 2: Create the evidence module

**Files:**
- Create: `code/core/src/telemetry/ai-prepare-evidence.ts`

- [ ] **Step 1: Create `code/core/src/telemetry/ai-prepare-evidence.ts`**

```ts
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { findConfigFile } from 'storybook/internal/common';
import type { IndexEntry, StoryIndex } from 'storybook/internal/types';

import { detectAgent } from './detect-agent.ts';
import { getAiSetupPending } from './event-cache.ts';
import { telemetry } from './index.ts';
import { SESSION_TIMEOUT } from './session-id.ts';
import type { EventType } from './types.ts';

/**
 * Title prefix the prompt instructs agents to use for generated stories.
 * When migrating to a tag-based approach, update isStoryCreatedByAISetup() below.
 */
export const AI_STORY_TITLE_PREFIX = 'AI Generated/';

/**
 * Record cached at ai-prepare time.
 * Read by subsequent CLI entry points for evidence collection.
 * Canonical definition — imported by event-cache.ts and setup-requirements.ts.
 */
export interface AiSetupPendingRecord {
  timestamp: number;
  sessionId: string;
  configDir: string;
  previewFile: string | null;
  previewHash: string | null;
  traits: Record<string, string>;
}

/**
 * Determines whether a story index entry was authored by the `sb ai prepare` flow.
 * Currently checks title prefix. When we migrate to a tag-based approach,
 * swap this to check for the tag instead — this is the single swap point.
 */
export function isStoryCreatedByAISetup(entry: { title: string; tags?: string[] }): boolean {
  return entry.title.startsWith(AI_STORY_TITLE_PREFIX);
}

/**
 * Count stories in the index that were created by `sb ai prepare`.
 */
export function countAiAuthoredStories(storyIndex: StoryIndex): number {
  return Object.values(storyIndex.entries).filter(
    (entry: IndexEntry) => entry.type === 'story' && isStoryCreatedByAISetup(entry)
  ).length;
}

/**
 * Check whether the preview file has changed from an ai-prepare baseline.
 * Returns true if: hash differs, file appeared, file disappeared, or file is unreadable.
 */
export async function checkPreviewChanged(
  configDir: string,
  baselineFile: string | null,
  baselineHash: string | null
): Promise<boolean> {
  const currentPath = findConfigFile('preview', configDir);
  if (currentPath !== baselineFile) {
    return true;
  }
  if (!currentPath) {
    return false;
  }
  try {
    const content = await readFile(currentPath, 'utf-8');
    const hash = createHash('sha256').update(content).digest('hex');
    return hash !== baselineHash;
  } catch {
    // File unreadable — treat as changed
    return true;
  }
}

/**
 * Check for a pending ai-prepare record and fire an evidence event if found.
 *
 * Called from:
 * - `withTelemetry` after the boot event for non-dev/build CLI commands (no story index)
 * - `doTelemetry` for dev/build commands (story index available)
 *
 * Gated on: agent detected → pending record exists → within session window → configDir matches.
 */
export async function collectAiPrepareEvidence(
  eventType: EventType,
  configDir: string | undefined,
  storyIndex?: StoryIndex
): Promise<void> {
  try {
    // Gate 1: Is this an agent? (cheapest check)
    const agent = detectAgent();
    if (!agent) {
      return;
    }

    // Gate 2: Is there a pending ai-prepare record?
    const pending = await getAiSetupPending();
    if (!pending) {
      return;
    }

    // Gate 3: Is it within the session window?
    const timeSinceSetup = Date.now() - pending.timestamp;
    if (timeSinceSetup > SESSION_TIMEOUT) {
      return;
    }

    // Gate 4: Does the configDir match? (cross-project guard)
    if (configDir && pending.configDir !== configDir) {
      return;
    }

    // Don't fire evidence for ai-prepare itself — the prepare command gives the
    // prompt to the agent and exits, so we only expect changes after the agent
    // has started processing it.
    if (eventType === 'ai-prepare') {
      return;
    }

    // Check if preview file changed from baseline
    const previewChanged = await checkPreviewChanged(
      pending.configDir,
      pending.previewFile,
      pending.previewHash
    );

    // Count AI-authored stories if story index is available
    const aiAuthoredStories = storyIndex ? countAiAuthoredStories(storyIndex) : undefined;

    await telemetry(
      'ai-prepare-evidence',
      {
        previewChanged,
        aiAuthoredStories,
        sessionId: pending.sessionId,
        timeSinceSetup,
      },
      {
        immediate: true,
        configDir,
      }
    );
  } catch {
    // Evidence collection is best-effort — never block the actual command
  }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit -p code/core/tsconfig.json 2>&1 | head -20`

Expected: May have errors from `event-cache.ts` still referencing old type — that's expected and fixed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/telemetry/ai-prepare-evidence.ts
git commit -m "feat: create ai-prepare-evidence module with evidence collection, story counting, and preview change detection"
```

---

### Task 3: Update `event-cache.ts` — type inheritance

**Files:**
- Modify: `code/core/src/telemetry/event-cache.ts:85-99`

- [ ] **Step 1: Replace the inline `AiSetupPendingRecord` with a type import**

In `code/core/src/telemetry/event-cache.ts`, replace lines 85-93:

```ts
// Before:
/** Shape of the cached ai-setup-pending record. Kept in sync with setup-requirements.ts. */
interface AiSetupPendingRecord {
  timestamp: number;
  sessionId: string;
  configDir: string;
  previewFile: string | null;
  previewHash: string | null;
  traits: Record<string, string>;
}

// After:
import type { AiSetupPendingRecord } from './ai-prepare-evidence.ts';
```

Note: This is a type-only import — no runtime circular dependency with `index.ts`.

Move the new import to the top of the file, alongside the existing imports (after line 3).

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit -p code/core/tsconfig.json 2>&1 | head -20`

Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/telemetry/event-cache.ts
git commit -m "refactor: replace inline AiSetupPendingRecord with type import from ai-prepare-evidence"
```

---

### Task 4: Update `setup-requirements.ts` — remove moved code, re-export

**Files:**
- Modify: `code/lib/cli-storybook/src/ai/setup-requirements.ts:1-24`

- [ ] **Step 1: Replace moved exports with re-exports**

In `code/lib/cli-storybook/src/ai/setup-requirements.ts`, remove the `isStoryAIGenerated` function (lines 22-24), the `AI_STORY_TITLE_PREFIX` constant (line 12), the `AI_EXPECTED_STORY_COMPONENTS` constant (line 15), and the `AiSetupPendingRecord` interface (lines 27-34). Replace with re-exports from the telemetry module.

This task has two sub-steps: first add re-exports to telemetry `index.ts` so `setup-requirements.ts` can import via `storybook/internal/telemetry`, then update `setup-requirements.ts` itself.

The `ai-prepare-evidence.ts` → `index.ts` circular import is safe: `collectAiPrepareEvidence` uses `telemetry()` only inside a function body (lazy reference), never at module top level.

- [ ] **Step 1: Add re-exports to `code/core/src/telemetry/index.ts`**

In `code/core/src/telemetry/index.ts`, after line 24, add:

```ts
export {
  AI_STORY_TITLE_PREFIX,
  collectAiPrepareEvidence,
  countAiAuthoredStories,
  isStoryCreatedByAISetup,
  type AiSetupPendingRecord,
} from './ai-prepare-evidence.ts';
```

- [ ] **Step 2: Update `setup-requirements.ts`**

Replace the moved definitions with imports from `storybook/internal/telemetry`:

```ts
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { findConfigFile } from 'storybook/internal/common';
import {
  AI_STORY_TITLE_PREFIX,
  isStoryCreatedByAISetup,
  type AiSetupPendingRecord,
} from 'storybook/internal/telemetry';

import type { AiPrepareTraits } from './types.ts';

// Re-export for backward compatibility
export { AI_STORY_TITLE_PREFIX, isStoryCreatedByAISetup, type AiSetupPendingRecord };

// Keep the old name as a deprecated alias
export const isStoryAIGenerated = isStoryCreatedByAISetup;

/** Expected number of story components the prompt asks the agent to create. */
export const AI_EXPECTED_STORY_COMPONENTS = 9;

/**
 * Snapshot the preview file state for baseline comparison.
 * Returns the filename and SHA-256 hash, or nulls if no preview file exists.
 */
export async function snapshotPreviewFile(
  configDir: string
): Promise<{ previewFile: string | null; previewHash: string | null }> {
  const previewPath = findConfigFile('preview', configDir);
  if (!previewPath) {
    return { previewFile: null, previewHash: null };
  }

  try {
    const content = await readFile(previewPath, 'utf-8');
    const hash = createHash('sha256').update(content).digest('hex');
    return { previewFile: previewPath, previewHash: hash };
  } catch {
    // File found by findConfigFile but unreadable — treat as absent
    return { previewFile: previewPath, previewHash: null };
  }
}

/**
 * Check whether the preview file has changed from the baseline snapshot.
 * Returns true if: hash differs, file appeared, file disappeared, or file was renamed.
 */
export async function hasPreviewChanged(
  configDir: string,
  baseline: { previewFile: string | null; previewHash: string | null }
): Promise<boolean> {
  const current = await snapshotPreviewFile(configDir);
  if (current.previewFile !== baseline.previewFile) {
    return true;
  }
  return current.previewHash !== baseline.previewHash;
}
```

- [ ] **Step 3: Check for other files that import `isStoryAIGenerated` or `AiSetupPendingRecord` from `setup-requirements.ts`**

Run: `grep -r "isStoryAIGenerated\|from.*setup-requirements" code/ --include="*.ts" -l`

Update any imports that reference the old names. The `ai/index.ts` file likely imports `AiSetupPendingRecord` and `isStoryAIGenerated` from `./setup-requirements.ts` — these still work via the re-exports.

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit -p code/core/tsconfig.json 2>&1 | head -20`

Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/telemetry/index.ts code/lib/cli-storybook/src/ai/setup-requirements.ts
git commit -m "refactor: move AiSetupPendingRecord and isStoryCreatedByAISetup to telemetry module, re-export from setup-requirements"
```

---

### Task 5: Remove moved code from `withTelemetry.ts`, wire up new module

**Files:**
- Modify: `code/core/src/core-server/withTelemetry.ts`

- [ ] **Step 1: Update imports**

In `code/core/src/core-server/withTelemetry.ts`, update the import block.

Remove from the `storybook/internal/telemetry` import (lines 12-21):
- `SESSION_TIMEOUT`
- `getAiSetupPending`

Remove entirely:
- `import { createHash } from 'node:crypto';` (line 1)
- `import { readFile } from 'node:fs/promises';` (line 2)
- `import { detectAgent } from '../telemetry/detect-agent.ts';` (line 25)
- `findConfigFile` from the `storybook/internal/common` import (line 7, keep `cache`, `HandledError`, `isCI`, `loadAllPresets`)

Add new import:
```ts
import { collectAiPrepareEvidence } from 'storybook/internal/telemetry';
```

The final import block should be:

```ts
import {
  HandledError,
  cache,
  isCI,
  loadAllPresets,
} from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import {
  ErrorCollector,
  collectAiPrepareEvidence,
  getPrecedingUpgrade,
  oneWayHash,
  telemetry,
} from 'storybook/internal/telemetry';
import type { EventType } from 'storybook/internal/telemetry';
import type { CLIOptions } from 'storybook/internal/types';

import { StorybookError } from '../storybook-error.ts';
```

- [ ] **Step 2: Remove `checkPreviewChanged` and `collectAiSetupEvidence` functions**

Delete lines 174-266 (the comment block + `checkPreviewChanged` function + comment block + `collectAiSetupEvidence` function).

- [ ] **Step 3: Update the fire-and-forget call in `withTelemetry`**

In the `withTelemetry` function, replace lines 295-298:

```ts
// Before:
  if (enableTelemetry) {
    // Fire-and-forget: don't await, don't block the command
    collectAiSetupEvidence(eventType, options).catch(() => {});
  }

// After:
  if (enableTelemetry) {
    // Fire-and-forget: don't await, don't block the command
    const configDir = options.cliOptions.configDir || options.presetOptions?.configDir;
    collectAiPrepareEvidence(eventType, configDir);
  }
```

Note: No `.catch()` needed — `collectAiPrepareEvidence` has its own try/catch wrapping everything. The returned promise rejection is already swallowed internally.

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit -p code/core/tsconfig.json 2>&1 | head -20`

Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/core-server/withTelemetry.ts
git commit -m "refactor: remove evidence collection from withTelemetry, import from telemetry module"
```

---

### Task 6: Wire evidence collection into `doTelemetry` for dev/build

**Files:**
- Modify: `code/core/src/core-server/utils/doTelemetry.ts`

- [ ] **Step 1: Add import and call**

In `code/core/src/core-server/utils/doTelemetry.ts`:

Add to the import from `storybook/internal/telemetry` (line 1):

```ts
// Before:
import { getPrecedingUpgrade, telemetry } from 'storybook/internal/telemetry';

// After:
import { collectAiPrepareEvidence, getPrecedingUpgrade, telemetry } from 'storybook/internal/telemetry';
```

After line 22 (`indexAndStats = await generator?.getIndexAndStats();`), before the payload construction, add the evidence collection call. Insert after the try/catch for `getIndexAndStats` (after line 38), before line 39:

```ts
    // Fire-and-forget: collect ai-prepare evidence with story index
    if (indexAndStats) {
      collectAiPrepareEvidence('dev', options.configDir, indexAndStats.storyIndex);
    }
```

The full function should become:

```ts
export async function doTelemetry(
  app: Polka,
  core: CoreConfig,
  storyIndexGeneratorPromise: Promise<StoryIndexGenerator>,
  options: Options
) {
  if (!core?.disableTelemetry) {
    const generator = await storyIndexGeneratorPromise;
    let indexAndStats;
    try {
      indexAndStats = await generator?.getIndexAndStats();
    } catch (err) {
      if (!(err instanceof Error)) {
        throw new Error('encountered a non-recoverable error');
      }
      sendTelemetryError(err, 'dev', {
        cliOptions: options,
        presetOptions: {
          ...options,
          corePresets: [],
          overridePresets: [],
        },
      });
      return;
    }

    // Fire-and-forget: collect ai-prepare evidence with story index
    if (indexAndStats) {
      collectAiPrepareEvidence('dev', options.configDir, indexAndStats.storyIndex);
    }

    const { versionCheck, versionUpdates } = options;
    invariant(
      !versionUpdates || (versionUpdates && versionCheck),
      'versionCheck should be defined when versionUpdates is true'
    );
    const payload = {
      precedingUpgrade: await getPrecedingUpgrade(),
    };
    if (indexAndStats) {
      Object.assign(payload, {
        versionStatus: versionUpdates && versionCheck ? versionStatus(versionCheck) : 'disabled',
        storyIndex: summarizeIndex(indexAndStats.storyIndex),
        storyStats: indexAndStats.stats,
      });
    }
    telemetry('dev', payload, { configDir: options.configDir });
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit -p code/core/tsconfig.json 2>&1 | head -20`

Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/core-server/utils/doTelemetry.ts
git commit -m "feat: fire ai-prepare evidence from doTelemetry with story index for dev/build commands"
```

---

### Task 7: Write evidence tests

**Files:**
- Create: `code/core/src/telemetry/ai-prepare-evidence.test.ts`

- [ ] **Step 1: Create the test file**

Create `code/core/src/telemetry/ai-prepare-evidence.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import {
  checkPreviewChanged,
  collectAiPrepareEvidence,
  countAiAuthoredStories,
  isStoryCreatedByAISetup,
} from './ai-prepare-evidence.ts';

// Mock modules with spy pattern
vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    findConfigFile: vi.fn(),
  };
});

vi.mock('./detect-agent.ts', () => ({
  detectAgent: vi.fn(() => undefined),
}));

vi.mock('./event-cache.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./event-cache.ts')>();
  return {
    ...actual,
    getAiSetupPending: vi.fn(() => undefined),
  };
});

vi.mock('./index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./index.ts')>();
  return {
    ...actual,
    telemetry: vi.fn(),
  };
});

// Import mocked modules for spy access
import { findConfigFile } from 'storybook/internal/common';
import { readFile } from 'node:fs/promises';
import { detectAgent } from './detect-agent.ts';
import { getAiSetupPending } from './event-cache.ts';
import { telemetry } from './index.ts';
import { SESSION_TIMEOUT } from './session-id.ts';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

const makePendingRecord = (overrides = {}) => ({
  timestamp: Date.now() - 60_000, // 1 minute ago
  sessionId: 'test-session-id',
  configDir: '/test/config',
  previewFile: '/test/config/preview.ts',
  previewHash: 'abc123',
  traits: { framework: 'react' },
  ...overrides,
});

const makeStoryIndex = (entries: Record<string, any> = {}): StoryIndex => ({
  v: 5,
  entries,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(telemetry).mockResolvedValue(undefined);
});

describe('isStoryCreatedByAISetup', () => {
  it('returns true for AI-titled stories', () => {
    expect(isStoryCreatedByAISetup({ title: 'AI Generated/Button' })).toBe(true);
  });

  it('returns false for regular stories', () => {
    expect(isStoryCreatedByAISetup({ title: 'Components/Button' })).toBe(false);
  });
});

describe('countAiAuthoredStories', () => {
  it('counts correctly with mixed entries', () => {
    const index = makeStoryIndex({
      'ai-1': { type: 'story', title: 'AI Generated/Button', id: 'ai-1', name: 'Default', importPath: './ai.stories.ts' },
      'ai-2': { type: 'story', title: 'AI Generated/Card', id: 'ai-2', name: 'Default', importPath: './ai2.stories.ts' },
      'regular': { type: 'story', title: 'Components/Input', id: 'regular', name: 'Default', importPath: './input.stories.ts' },
      'docs': { type: 'docs', title: 'AI Generated/Docs', id: 'docs', name: 'Docs', importPath: './docs.mdx', storiesImports: [] },
    });
    // Only type: 'story' entries are counted, not docs
    expect(countAiAuthoredStories(index)).toBe(2);
  });

  it('returns 0 when no AI stories exist', () => {
    const index = makeStoryIndex({
      'regular': { type: 'story', title: 'Components/Button', id: 'regular', name: 'Default', importPath: './button.stories.ts' },
    });
    expect(countAiAuthoredStories(index)).toBe(0);
  });
});

describe('checkPreviewChanged', () => {
  it('returns false when hash matches snapshot', async () => {
    vi.mocked(findConfigFile).mockReturnValue('/test/config/preview.ts');
    vi.mocked(readFile).mockResolvedValue('file content');

    // Pre-compute the expected hash
    const { createHash } = await import('node:crypto');
    const expectedHash = createHash('sha256').update('file content').digest('hex');

    const result = await checkPreviewChanged('/test/config', '/test/config/preview.ts', expectedHash);
    expect(result).toBe(false);
  });

  it('returns true when hash differs from snapshot', async () => {
    vi.mocked(findConfigFile).mockReturnValue('/test/config/preview.ts');
    vi.mocked(readFile).mockResolvedValue('modified content');

    const result = await checkPreviewChanged('/test/config', '/test/config/preview.ts', 'old-hash');
    expect(result).toBe(true);
  });

  it('returns true when preview file is missing or unreadable', async () => {
    vi.mocked(findConfigFile).mockReturnValue('/test/config/preview.ts');
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

    const result = await checkPreviewChanged('/test/config', '/test/config/preview.ts', 'some-hash');
    expect(result).toBe(true);
  });

  it('returns true when file path changed', async () => {
    vi.mocked(findConfigFile).mockReturnValue('/test/config/preview.tsx');

    const result = await checkPreviewChanged('/test/config', '/test/config/preview.ts', 'hash');
    expect(result).toBe(true);
  });
});

describe('collectAiPrepareEvidence', () => {
  it('does not fire when no agent detected', async () => {
    vi.mocked(detectAgent).mockReturnValue(undefined);

    await collectAiPrepareEvidence('dev', '/test/config');
    expect(telemetry).not.toHaveBeenCalled();
  });

  it('does not fire when no pending record', async () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    vi.mocked(getAiSetupPending).mockResolvedValue(undefined);

    await collectAiPrepareEvidence('dev', '/test/config');
    expect(telemetry).not.toHaveBeenCalled();
  });

  it('does not fire when pending record is expired', async () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    vi.mocked(getAiSetupPending).mockResolvedValue(
      makePendingRecord({ timestamp: Date.now() - SESSION_TIMEOUT - 1000 })
    );

    await collectAiPrepareEvidence('dev', '/test/config');
    expect(telemetry).not.toHaveBeenCalled();
  });

  it('does not fire when configDir does not match', async () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    vi.mocked(getAiSetupPending).mockResolvedValue(
      makePendingRecord({ configDir: '/other/project/.storybook' })
    );

    await collectAiPrepareEvidence('dev', '/test/config');
    expect(telemetry).not.toHaveBeenCalled();
  });

  it('fires event with correct payload when all gates pass', async () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    const pending = makePendingRecord({ configDir: '/test/config' });
    vi.mocked(getAiSetupPending).mockResolvedValue(pending);
    vi.mocked(findConfigFile).mockReturnValue(pending.previewFile);
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

    await collectAiPrepareEvidence('dev', '/test/config');

    expect(telemetry).toHaveBeenCalledWith(
      'ai-prepare-evidence',
      expect.objectContaining({
        previewChanged: true,
        aiAuthoredStories: undefined,
        sessionId: 'test-session-id',
      }),
      expect.objectContaining({
        immediate: true,
        configDir: '/test/config',
      })
    );
  });

  it('reports aiAuthoredStories as undefined when no story index provided', async () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    const pending = makePendingRecord({ configDir: '/test/config' });
    vi.mocked(getAiSetupPending).mockResolvedValue(pending);
    vi.mocked(findConfigFile).mockReturnValue(null);

    await collectAiPrepareEvidence('dev', '/test/config');

    expect(telemetry).toHaveBeenCalledWith(
      'ai-prepare-evidence',
      expect.objectContaining({
        aiAuthoredStories: undefined,
      }),
      expect.anything()
    );
  });

  it('counts aiAuthoredStories when story index provided', async () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    const pending = makePendingRecord({ configDir: '/test/config', previewFile: null, previewHash: null });
    vi.mocked(getAiSetupPending).mockResolvedValue(pending);
    vi.mocked(findConfigFile).mockReturnValue(null);

    const storyIndex = makeStoryIndex({
      'ai-1': { type: 'story', title: 'AI Generated/Button', id: 'ai-1', name: 'Default', importPath: './ai.stories.ts' },
      'regular': { type: 'story', title: 'Components/Input', id: 'regular', name: 'Default', importPath: './input.stories.ts' },
    });

    await collectAiPrepareEvidence('dev', '/test/config', storyIndex);

    expect(telemetry).toHaveBeenCalledWith(
      'ai-prepare-evidence',
      expect.objectContaining({
        aiAuthoredStories: 1,
      }),
      expect.anything()
    );
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `yarn vitest run code/core/src/telemetry/ai-prepare-evidence.test.ts`

Expected: All 10 tests pass.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/telemetry/ai-prepare-evidence.test.ts
git commit -m "test: add 10 unit tests for ai-prepare-evidence module"
```

---

### Task 8: Clean up `withTelemetry.test.ts` and fix `storybook-metadata.test.ts`

**Files:**
- Modify: `code/core/src/core-server/withTelemetry.test.ts:12-14`
- Modify: `code/core/src/telemetry/storybook-metadata.test.ts:569`

- [ ] **Step 1: Remove dead `detect-agent` mock from `withTelemetry.test.ts`**

In `code/core/src/core-server/withTelemetry.test.ts`, remove lines 12-14:

```ts
// Remove these lines:
vi.mock('../telemetry/detect-agent.ts', () => ({
  detectAgent: vi.fn(() => undefined),
}));
```

This mock was needed when `collectAiSetupEvidence` lived in `withTelemetry.ts` and imported `detectAgent`. Now that the function moved to the telemetry module, this mock is dead code.

- [ ] **Step 2: Fix test name in `storybook-metadata.test.ts`**

In `code/core/src/telemetry/storybook-metadata.test.ts`, line 569:

```ts
// Before:
it('should not detect userSince info in CI when not running as an agent', async () => {

// After:
it('should not detect userSince info in CI when agent is not detected', async () => {
```

- [ ] **Step 3: Run both test files**

Run: `yarn vitest run code/core/src/core-server/withTelemetry.test.ts code/core/src/telemetry/storybook-metadata.test.ts`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add code/core/src/core-server/withTelemetry.test.ts code/core/src/telemetry/storybook-metadata.test.ts
git commit -m "chore: clean up dead detect-agent mock, fix test name for agent detection"
```

---

### Task 9: Add AI-written story scoring to ghost stories channel

**Files:**
- Modify: `code/core/src/core-server/server-channel/ghost-stories-channel.ts`
- Modify: `code/core/src/core-server/presets/common-preset.ts:283`

- [ ] **Step 1: Update `initGhostStoriesChannel` signature to accept story index generator**

In `code/core/src/core-server/server-channel/ghost-stories-channel.ts`:

Update the import block:

```ts
import type { Channel } from 'storybook/internal/channels';
import { GHOST_STORIES_REQUEST, GHOST_STORIES_RESPONSE } from 'storybook/internal/core-events';
import { getLastEvents, getStorybookMetadata, telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig, Options } from 'storybook/internal/types';

import { isStoryCreatedByAISetup } from '../../telemetry/ai-prepare-evidence.ts';
import { fullTestProviderStore } from '../stores/test-provider.ts';
import { getComponentCandidates } from '../utils/ghost-stories/get-candidates.ts';
import { runGhostStories } from '../utils/ghost-stories/run-story-tests.ts';
import type { StoryIndexGenerator } from '../utils/StoryIndexGenerator.ts';
```

Update the function signature to accept a getter (deferred access pattern):

```ts
// Before:
export function initGhostStoriesChannel(
  channel: Channel,
  options: Options,
  coreOptions: CoreConfig
) {

// After:
export function initGhostStoriesChannel(
  channel: Channel,
  options: Options,
  coreOptions: CoreConfig,
  getStoryIndexGeneratorPromise?: () => Promise<StoryIndexGenerator> | undefined
) {
```

- [ ] **Step 2: Add `waitForTestsIdle` helper**

Add before the `initGhostStoriesChannel` function:

```ts
/**
 * Wait for the test provider to be idle (no tests running).
 * Returns true if idle, false if timed out.
 */
async function waitForTestsIdle(
  maxWaitMs = 30 * 60 * 1000,
  pollIntervalMs = 60 * 1000
): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const state = fullTestProviderStore.getFullState();
      const isRunning = Object.values(state).some(
        (s) => s === 'test-provider-state:running'
      );
      if (!isRunning) {
        return true;
      }
    } catch {
      // Store not initialized yet — treat as idle
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return false;
}
```

- [ ] **Step 3: Add CPU capacity check before ghost stories scoring**

Wrap the existing Phase 1 + Phase 2 in a CPU check. Inside the `channel.on(GHOST_STORIES_REQUEST, ...)` handler, after the React + Vitest gate (line 53), add:

```ts
      // Wait for any running tests to finish before launching scoring
      const isIdle = await waitForTestsIdle();
      if (!isIdle) {
        telemetry('ghost-stories', {
          stats,
          runError: 'Timed out waiting for tests to finish',
        });
        return;
      }
```

- [ ] **Step 4: Add AI-written story scoring after ghost stories scoring**

After the ghost stories telemetry event fires (after line 99), but before the `catch` block, add AI story scoring:

```ts
      // Phase 3: Score AI-written stories (if any)
      const generatorPromise = getStoryIndexGeneratorPromise?.();
      if (generatorPromise) {
        try {
          const generator = await generatorPromise;
          const indexAndStats = await generator.getIndexAndStats();
          if (indexAndStats) {
            const aiStoryFiles = new Set<string>();
            for (const entry of Object.values(indexAndStats.storyIndex.entries)) {
              if (entry.type === 'story' && isStoryCreatedByAISetup(entry)) {
                aiStoryFiles.add(entry.importPath);
              }
            }

            if (aiStoryFiles.size > 0) {
              const aiTestRunResult = await runGhostStories([...aiStoryFiles]);
              telemetry('ai-prepare-story-scoring', {
                stats: {
                  fileCount: aiStoryFiles.size,
                  testRunDuration: aiTestRunResult.duration,
                },
                results: aiTestRunResult.summary,
                ...(aiTestRunResult.runError
                  ? { runError: aiTestRunResult.runError }
                  : {}),
              });
            }
          }
        } catch {
          telemetry('ai-prepare-story-scoring', {
            runError: 'Unknown error during AI story scoring',
          });
        }
      }
```

- [ ] **Step 5: Update `common-preset.ts` to pass story index generator**

In `code/core/src/core-server/presets/common-preset.ts`, line 283.

The module-level `storyIndexGeneratorPromise` (line 318) may not be set yet when `experimental_serverChannel` runs (line 271), because presets are applied in sequence and `storyIndexGenerator` runs later. Since ghost stories run on a 10-minute delay, pass a getter function that defers access:

```ts
// Before:
  initGhostStoriesChannel(channel, options, coreOptions);

// After:
  initGhostStoriesChannel(channel, options, coreOptions, () => storyIndexGeneratorPromise);
```

The ghost stories channel signature (from Step 1) accepts a getter `() => Promise<StoryIndexGenerator> | undefined`, and the handler calls it at invocation time (10+ minutes later), when the generator is guaranteed to be initialized.

Note: The `initGhostStoriesChannel` function signature uses the getter pattern:

```ts
export function initGhostStoriesChannel(
  channel: Channel,
  options: Options,
  coreOptions: CoreConfig,
  getStoryIndexGeneratorPromise?: () => Promise<StoryIndexGenerator> | undefined
) {
```

And inside the handler body, the Phase 3 code calls it:

```ts
      const generatorPromise = getStoryIndexGeneratorPromise?.();
      if (generatorPromise) {
        // ... AI story scoring
      }
```

- [ ] **Step 6: Verify compilation**

Run: `npx tsc --noEmit -p code/core/tsconfig.json 2>&1 | head -20`

Expected: No new errors.

- [ ] **Step 7: Commit**

```bash
git add code/core/src/core-server/server-channel/ghost-stories-channel.ts code/core/src/core-server/presets/common-preset.ts
git commit -m "feat: add AI story scoring to ghost stories channel with CPU capacity check"
```

---

### Task 10: Full verification

**Files:** None (verification only)

- [ ] **Step 1: Compile all packages**

Run: `yarn nx run-many -t compile`

Expected: All packages compile successfully.

- [ ] **Step 2: Type check**

Run: `yarn nx run-many -t check`

Expected: No new errors (pre-existing `nextjs-vite:check` error is known).

- [ ] **Step 3: Run all telemetry tests**

Run: `yarn vitest run code/core/src/telemetry/`

Expected: All tests pass.

- [ ] **Step 4: Run withTelemetry tests**

Run: `yarn vitest run code/core/src/core-server/withTelemetry.test.ts`

Expected: All tests pass.

- [ ] **Step 5: Run full test suite**

Run: `yarn test`

Expected: All tests pass (or only pre-existing failures).

- [ ] **Step 6: Grep for stale references**

Run:
```bash
grep -r "ai-setup-evidence" code/ --include="*.ts" -l
grep -r "isStoryAIGenerated" code/ --include="*.ts" -l
grep -r "collectAiSetupEvidence" code/ --include="*.ts" -l
grep -r "doctorRanSinceSetup" code/ --include="*.ts" -l
```

Expected:
- `ai-setup-evidence`: No matches (all renamed to `ai-prepare-evidence`)
- `isStoryAIGenerated`: Only in `setup-requirements.ts` as the deprecated re-export alias
- `collectAiSetupEvidence`: No matches (renamed to `collectAiPrepareEvidence`)
- `doctorRanSinceSetup`: No matches (removed)

- [ ] **Step 7: Final commit if any fixups needed**

If grep reveals stale references, fix them and commit:

```bash
git add -A
git commit -m "chore: clean up stale references from evidence module reorganization"
```

---

## Summary of Changes

| Requirement (Section 9) | Task |
|-------------------------|------|
| 9.1a Rename event | Task 1 |
| 9.1b Move evidence code | Tasks 2, 5 |
| 9.1c Move story checker | Tasks 2, 4 |
| 9.1d Type inheritance | Task 3 |
| 9.1e Minor fixes | Tasks 5, 8 |
| 9.2a Remove doctorRanSinceSetup | Task 2 (not included in new module) |
| 9.2b aiAuthoredStories counting | Tasks 2, 6 |
| 9.2c Cache scoping (configDir) | Task 2 (Gate 4 in collectAiPrepareEvidence) |
| 9.2d Payload shape | Task 2 |
| 9.3 Evidence tests | Task 7 |
| 9.3 Spy-based mocks | Task 7 |
| 9.3 Fix test name | Task 8 |
| 9.3 Clean up withTelemetry.test.ts | Task 8 |
| 9.4a AI story scoring event | Task 9 |
| 9.4b CPU capacity check | Task 9 |
| 9.4c Story index access | Task 9 |
| Full verification | Task 10 |
