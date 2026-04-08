# WS1: Agentic Telemetry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship observability into agent-driven Storybook usage — agent-in-CI identity, `sb ai prepare` telemetry with prompt traits, and reliable ghost-stories coverage.

**Architecture:** Six independent changes that compose into a single PR. Agent-in-CI fix is a 1-line change. `sb ai prepare` gets explicit start/end telemetry events with a traits accumulator threaded through prompt generation. Ghost stories trigger moves from modal to a 10min-delayed manager hook with a once-ever server-side gate. A mock telemetry receiver script supports local development.

**Tech Stack:** TypeScript, React (manager UI), Node.js (server/CLI), Vitest (tests)

**Design doc:** `docs/superpowers/specs/2026-04-07-telemetry-enhancements-design.md`

**PM companion:** `docs/superpowers/specs/2026-04-08-ws1-agentic-telemetry-plan-pm.md`

**Repo conventions:**
- Run commands from repo root unless stated otherwise
- Use `yarn` (Yarn Berry) as package manager
- Use `storybook/internal/*` import paths for core internals
- Use explicit `.ts`/`.tsx` extensions in relative imports
- Use `storybook/internal/node-logger` logger, not `console.*`
- Run `yarn lint` and `yarn --cwd code lint:js:cmd <path> --fix` for linting
- Run `yarn test` for unit tests (Vitest)

---

## Task 1: Preserve `userSince` for agents in CI

**Files:**
- Modify: `code/core/src/telemetry/storybook-metadata.ts:116`
- Modify: `code/core/src/telemetry/storybook-metadata.test.ts`

- [ ] **Step 1: Write the failing test**

Add a new test case in `code/core/src/telemetry/storybook-metadata.test.ts`. Find the existing test `'should not detect userSince info in CI'` (around line 565) and add a new test after it:

```ts
it('should detect userSince info in CI when agent is detected', async () => {
  vi.mocked(isCI).mockImplementation(() => true);
  const { detectAgent } = await import('../telemetry/detect-agent.ts');
  vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
  vi.mocked(globalSettings).mockResolvedValue({
    value: {
      userSince: 1717334400000,
    },
  } as Settings);

  const res = await computeStorybookMetadata({
    configDir: '.storybook',
    packageJson: packageJsonMock,
    packageJsonPath,
    mainConfig: mainJsMock,
  });

  expect(globalSettings).toHaveBeenCalled();
  expect(res.userSince).toEqual(1717334400000);
});
```

You'll also need to add the `detectAgent` import at the top of the test file and mock it. Add to the existing vi.mock block or create a new one:

```ts
vi.mock('../telemetry/detect-agent.ts', () => ({
  detectAgent: vi.fn().mockReturnValue(undefined),
}));
```

And add to the import section:

```ts
import { detectAgent } from '../telemetry/detect-agent.ts';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn vitest run code/core/src/telemetry/storybook-metadata.test.ts --reporter=verbose 2>&1 | tail -30`

Expected: The new test fails because `globalSettings` is not called when `isCI()` returns true.

- [ ] **Step 3: Implement the fix**

In `code/core/src/telemetry/storybook-metadata.ts`, line 116, change:

```ts
const settings = isCI() ? undefined : await globalSettings();
```

to:

```ts
const settings = isCI() && !detectAgent() ? undefined : await globalSettings();
```

Add the import for `detectAgent` at the top of the file (add to the existing imports area around line 1-15):

```ts
import { detectAgent } from '../telemetry/detect-agent.ts';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn vitest run code/core/src/telemetry/storybook-metadata.test.ts --reporter=verbose 2>&1 | tail -30`

Expected: All tests pass, including the new one.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/telemetry/storybook-metadata.ts code/core/src/telemetry/storybook-metadata.test.ts
git commit -m "feat(telemetry): preserve userSince for agents in CI"
```

---

## Task 2: Add `'ai-setup-evidence'` to the EventType union

**Files:**
- Modify: `code/core/src/telemetry/types.ts`

- [ ] **Step 1: Add the new event type**

In `code/core/src/telemetry/types.ts`, find the `EventType` union (lines 9-48). The last entry is `| 'ai-prepare';`. Add after it:

```ts
  | 'ai-setup-evidence';
```

- [ ] **Step 2: Verify compilation**

Run: `yarn nx compile storybook`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/telemetry/types.ts
git commit -m "feat(telemetry): add ai-setup-evidence event type"
```

---

## Task 3: Add traits type, extend ai-prepare options, and create setup-requirements module

**Files:**
- Modify: `code/lib/cli-storybook/src/ai/types.ts`
- Create: `code/lib/cli-storybook/src/ai/setup-requirements.ts`

- [ ] **Step 1: Add the traits type and extend options**

In `code/lib/cli-storybook/src/ai/types.ts`, add the traits type after the existing `AiPrepareOptions` interface, and add `frontmatter?: boolean` to the options:

```ts
export interface AiPrepareOptions {
  configDir?: string;
  packageManager?: string;
  output?: string;
  frontmatter?: boolean;
}

/**
 * Flat object mapping trait names to version strings.
 * Each trait corresponds to a conditional branch in prompt generation.
 * Active traits have a version like 'v1', 'factory-v1', etc.
 * Add new traits here as prompt.ts gains new conditional sections.
 */
export interface AiPrepareTraits {
  /** CSF syntax variant: 'factory-v1' when hasCsfFactoryPreview, else 'csf3-v1' */
  csfSyntax: string;
  /** Overall setup instructions baseline version */
  setupGenericV1: string;
  /** Extensible: add more traits as prompt.ts evolves */
  [key: string]: string;
}
```

Note: this modifies the existing `AiPrepareOptions` to add `frontmatter?: boolean`.

- [ ] **Step 2: Create setup-requirements.ts**

Create `code/lib/cli-storybook/src/ai/setup-requirements.ts`. This module is **colocated with prompt.ts** so that when prompt instructions change, the observation requirements naturally update alongside:

```ts
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { findConfigFile } from 'storybook/internal/common';

import type { AiPrepareTraits } from './types.ts';

/**
 * Title prefix the prompt instructs agents to use for generated stories.
 * When migrating to a tag-based approach, update isStoryAIGenerated() below.
 */
export const AI_STORY_TITLE_PREFIX = 'AI Generated/';

/** Expected number of story components the prompt asks the agent to create. */
export const AI_EXPECTED_STORY_COMPONENTS = 9;

/**
 * Determines whether a story index entry was authored by AI setup.
 * Currently checks title prefix. When we migrate to a tag-based approach,
 * swap this to check for the tag instead — this is the single swap point.
 */
export function isStoryAIGenerated(entry: { title: string; tags?: string[] }): boolean {
  return entry.title.startsWith(AI_STORY_TITLE_PREFIX);
}

/** Record cached at ai-prepare time. Read by subsequent CLI entry points for evidence collection. */
export interface AiSetupPendingRecord {
  timestamp: number;
  sessionId: string;
  configDir: string;
  previewFile: string | null;
  previewHash: string | null;
  traits: AiPrepareTraits;
}

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

  // Different file path (including one being null) = changed
  if (current.previewFile !== baseline.previewFile) {
    return true;
  }

  // Same path (or both null) — compare hashes
  return current.previewHash !== baseline.previewHash;
}
```

Note: `findConfigFile` is exported from `storybook/internal/common` (originally defined in `code/core/src/common/utils/get-storybook-info.ts:105`). Verify this import path is correct during implementation — it may need to be imported from a more specific path.

- [ ] **Step 3: Verify compilation**

Run: `yarn nx compile cli-storybook`

Expected: No errors. (If `findConfigFile` import path is wrong, fix it.)

- [ ] **Step 4: Commit**

```bash
git add code/lib/cli-storybook/src/ai/types.ts code/lib/cli-storybook/src/ai/setup-requirements.ts
git commit -m "feat(ai): add AiPrepareTraits, setup-requirements module with isStoryAIGenerated checker"
```

---

## Task 4: Thread traits accumulator through prompt generation

**Files:**
- Modify: `code/lib/cli-storybook/src/ai/prompt.ts`

- [ ] **Step 1: Modify `getPrompts` to return traits alongside prompts**

In `code/lib/cli-storybook/src/ai/prompt.ts`, modify the import and function signatures:

Add the import for `AiPrepareTraits`:

```ts
import type { ProjectInfo, AiPrompt, AiPrepareTraits } from './types.ts';
```

Change the return type of `getPrompts` to include traits:

```ts
export function getPrompts(projectInfo: ProjectInfo): { prompts: AiPrompt[]; traits: AiPrepareTraits } {
  const traits: AiPrepareTraits = {
    csfSyntax: projectInfo.hasCsfFactoryPreview ? 'factory-v1' : 'csf3-v1',
    setupGenericV1: 'v1',
  };

  const aiPrompts: AiPrompt[] = [];

  aiPrompts.push({
    name: 'setup',
    description: 'Set up Storybook for success',
    instructions: getSetupInstructions(projectInfo),
  });

  return { prompts: aiPrompts, traits };
}
```

- [ ] **Step 2: Update `generateMarkdownOutput` to return traits**

Change the `generateMarkdownOutput` function to also return traits:

```ts
export function generateMarkdownOutput(projectInfo: ProjectInfo): { markdown: string; traits: AiPrepareTraits } {
  const { prompts: aiPrompts, traits } = getPrompts(projectInfo);

  const sections: string[] = [];

  sections.push(dedent`
    # Storybook Setup
  `);

  sections.push(getProjectOverview(projectInfo));

  for (const aiPrompt of aiPrompts) {
    sections.push(aiPrompt.instructions);
  }

  return { markdown: sections.join('\n\n'), traits };
}
```

- [ ] **Step 3: Verify compilation**

Run: `yarn nx compile cli-storybook`

Expected: Compilation error in `ai/index.ts` because it calls `generateMarkdownOutput` expecting a string. This is expected — we fix it in the next task.

- [ ] **Step 4: Commit**

```bash
git add code/lib/cli-storybook/src/ai/prompt.ts
git commit -m "feat(ai): thread traits accumulator through prompt generation"
```

---

## Task 5: Add telemetry, baseline snapshot, and frontmatter to `aiPrepare()`

**Files:**
- Modify: `code/lib/cli-storybook/src/ai/index.ts`
- Modify: `code/lib/cli-storybook/src/bin/run.ts`

- [ ] **Step 1: Rewrite `aiPrepare()` with telemetry, baseline caching, and frontmatter**

Replace the contents of `code/lib/cli-storybook/src/ai/index.ts` with:

```ts
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { PackageManagerName } from 'storybook/internal/common';
import { cache } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { getSessionId, telemetry } from 'storybook/internal/telemetry';
import { SupportedLanguage } from 'storybook/internal/types';

import { ProjectTypeService } from '../../../create-storybook/src/services/ProjectTypeService.ts';

import { getStorybookData } from '../automigrate/helpers/mainConfigFile.ts';
import { generateMarkdownOutput } from './prompt.ts';
import { snapshotPreviewFile } from './setup-requirements.ts';
import type { AiSetupPendingRecord } from './setup-requirements.ts';
import type { ProjectInfo, AiPrepareOptions, AiPrepareTraits } from './types.ts';

export async function aiPrepare(options: AiPrepareOptions): Promise<void> {
  const { configDir: userConfigDir, packageManager: packageManagerName, output, frontmatter } = options;

  let projectInfo: ProjectInfo;

  try {
    const data = await getStorybookData({
      configDir: userConfigDir,
      packageManagerName: packageManagerName as PackageManagerName | undefined,
    });
    const majorVersion = data.versionInstalled
      ? parseMajorVersion(data.versionInstalled)
      : undefined;

    if (!data.frameworkPackage || !data.rendererPackage || !data.builderPackage) {
      logger.error(
        'Could not detect framework, renderer, or builder from your Storybook config. Make sure you are running this command from your project root, or specify --config-dir.'
      );
      return;
    }

    const projectTypeService = new ProjectTypeService(data.packageManager);
    const detectedLanguage = await projectTypeService.detectLanguage();
    const language = detectedLanguage === SupportedLanguage.TYPESCRIPT ? 'ts' : 'js';

    projectInfo = {
      storybookVersion: data.versionInstalled,
      majorVersion,
      framework: data.frameworkPackage,
      rendererPackage: data.rendererPackage,
      renderer: data.renderer,
      builderPackage: data.builderPackage,
      addons: data.addons ?? [],
      configDir: data.configDir,
      storiesPaths: data.storiesPaths,
      hasCsfFactoryPreview: data.hasCsfFactoryPreview,
      language,
    };
  } catch (err: unknown) {
    logger.error(
      `Failed to read Storybook configuration: ${err instanceof Error ? err.message : String(err)}`
    );
    logger.log(
      'Make sure you are running this command from your project root, or specify --config-dir.'
    );
    return;
  }

  // Fire start event with project context
  await telemetry('ai-prepare', {
    cliOptions: {
      output: output ? 'file' : undefined,
      configDir: projectInfo.configDir,
      packageManager: packageManagerName,
    },
    project: {
      framework: projectInfo.framework,
      renderer: projectInfo.rendererPackage,
      builder: projectInfo.builderPackage,
      language: projectInfo.language,
      hasCsfFactoryPreview: projectInfo.hasCsfFactoryPreview,
    },
  });

  if (
    projectInfo.rendererPackage !== '@storybook/react' &&
    projectInfo.builderPackage !== '@storybook/builder-vite'
  ) {
    logger.log(
      'AI-assisted setup is currently only available for projects using the React renderer with Vite builder. Detected renderer: ' +
        projectInfo.rendererPackage +
        ', builder: ' +
        projectInfo.builderPackage
    );
    return;
  }

  const result = generateMarkdownOutput(projectInfo);
  const markdownOutput = result.markdown;
  const traits = result.traits;

  // Snapshot the preview file baseline and cache the pending setup record.
  // Subsequent CLI entry points (dev, build, doctor, etc.) read this to
  // collect evidence of what the agent accomplished.
  const resolvedConfigDir = resolve(projectInfo.configDir);
  const previewSnapshot = await snapshotPreviewFile(resolvedConfigDir);
  const sessionId = await getSessionId();
  const pendingRecord: AiSetupPendingRecord = {
    timestamp: Date.now(),
    sessionId,
    configDir: resolvedConfigDir,
    previewFile: previewSnapshot.previewFile,
    previewHash: previewSnapshot.previewHash,
    traits,
  };
  await cache.set('ai-setup-pending', pendingRecord);

  let finalOutput = markdownOutput;
  if (frontmatter && output) {
    const frontmatterBlock = buildFrontmatter(projectInfo, traits);
    finalOutput = frontmatterBlock + markdownOutput;
  }

  if (output) {
    const outputPath = resolve(output);
    await writeFile(outputPath, finalOutput, 'utf-8');
    logger.log(`Prompt written to ${outputPath}`);
  } else {
    logger.log(finalOutput);
  }
}

function buildFrontmatter(projectInfo: ProjectInfo, traits: AiPrepareTraits): string {
  const lines = [
    '---',
    `storybook: ${projectInfo.storybookVersion || 'unknown'}`,
    `framework: '${projectInfo.framework || 'unknown'}'`,
    `renderer: '${projectInfo.rendererPackage || 'unknown'}'`,
    `builder: '${projectInfo.builderPackage || 'unknown'}'`,
    `language: ${projectInfo.language}`,
    `hasCsfFactoryPreview: ${projectInfo.hasCsfFactoryPreview}`,
    'traits:',
  ];
  for (const [key, value] of Object.entries(traits)) {
    lines.push(`  ${key}: ${value}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

function parseMajorVersion(version: string): number | undefined {
  const match = version.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}
```

Key differences from the previous version:
- No `ai-prepare-end` event. Completion is tracked via `ai-setup-evidence` (Task 5b below).
- Caches `'ai-setup-pending'` record with preview file baseline, traits, timestamp, and session ID.
- Imports `cache` from `storybook/internal/common`, `getSessionId` from `storybook/internal/telemetry`.
- Imports `snapshotPreviewFile` and `AiSetupPendingRecord` from `./setup-requirements.ts`.
- No try/finally around the prompt generation — errors are caught by the outer `withTelemetry` wrapper.

- [ ] **Step 2: Add `--frontmatter` option to CLI**

In `code/lib/cli-storybook/src/bin/run.ts`, find the `ai prepare` command (around line 314). Add the `--frontmatter` option after the existing `--config-dir` option:

Find:
```ts
  .option('-c, --config-dir <dir-name>', 'Directory of Storybook configuration')
  .action(async (options, cmd) => {
```

Replace with:
```ts
  .option('-c, --config-dir <dir-name>', 'Directory of Storybook configuration')
  .option(
    '--frontmatter',
    'Prepend YAML frontmatter with project context and traits (requires --output)'
  )
  .action(async (options, cmd) => {
```

- [ ] **Step 3: Verify compilation**

Run: `yarn nx compile cli-storybook`

Expected: No errors.

- [ ] **Step 4: Run existing tests**

Run: `yarn vitest run --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|Tests)" | tail -5`

Expected: No regressions.

- [ ] **Step 5: Commit**

```bash
git add code/lib/cli-storybook/src/ai/index.ts code/lib/cli-storybook/src/bin/run.ts
git commit -m "feat(ai): add telemetry, baseline snapshot, and frontmatter to sb ai prepare"
```

---

## Task 5b: Add evidence collection hook in `withTelemetry`

**Files:**
- Modify: `code/core/src/core-server/withTelemetry.ts`
- Modify: `code/core/src/core-server/utils/doTelemetry.ts`
- Modify: `code/core/src/telemetry/event-cache.ts`

- [ ] **Step 1: Add ai-setup-pending cache helpers to event-cache.ts**

In `code/core/src/telemetry/event-cache.ts`, add helpers for reading and clearing the pending record. Add at the end of the file (after the `getPrecedingUpgrade` function):

```ts
/** Shape of the cached ai-setup-pending record. Kept in sync with setup-requirements.ts. */
interface AiSetupPendingRecord {
  timestamp: number;
  sessionId: string;
  configDir: string;
  previewFile: string | null;
  previewHash: string | null;
  traits: Record<string, string>;
}

export const getAiSetupPending = async (): Promise<AiSetupPendingRecord | undefined> => {
  await processingPromise;
  return (await cache.get('ai-setup-pending')) ?? undefined;
};
```

Also add the export in `code/core/src/telemetry/index.ts`:

```ts
export { getPrecedingUpgrade, getLastEvents, type CacheEntry, getAiSetupPending } from './event-cache.ts';
```

- [ ] **Step 2: Add evidence collection function**

Create a new function in `code/core/src/core-server/withTelemetry.ts`. Add it before the `withTelemetry` function (around line 160):

```ts
import { SESSION_TIMEOUT } from 'storybook/internal/telemetry';
```

Wait — `SESSION_TIMEOUT` is not currently re-exported. You'll need to either:
(a) Add `export { SESSION_TIMEOUT } from './session-id.ts';` to `code/core/src/telemetry/index.ts`, or
(b) Import it directly from the session-id module.

Use option (a) — add to the existing exports in `code/core/src/telemetry/index.ts`:

```ts
export { getSessionId, SESSION_TIMEOUT } from './session-id.ts';
```

Then in `withTelemetry.ts`, add the imports and the evidence collection function:

```ts
import { detectAgent } from '../telemetry/detect-agent.ts';
import {
  ErrorCollector,
  getAiSetupPending,
  getLastEvents,
  getPrecedingUpgrade,
  oneWayHash,
  SESSION_TIMEOUT,
  telemetry,
} from 'storybook/internal/telemetry';
```

Add the evidence collection function before `withTelemetry`:

```ts
/**
 * Check for a pending ai-setup record and fire an evidence event if found.
 * Called from withTelemetry after the boot event for every CLI command.
 * Gated on: agent detected → pending record exists → within session window.
 */
async function collectAiSetupEvidence(
  eventType: EventType,
  options: TelemetryOptions
): Promise<void> {
  try {
    // Gate 1: Is this an agent? (cheapest check)
    const agent = detectAgent();
    if (!agent) {
      return;
    }

    // Gate 2: Is there a pending ai-setup record?
    const pending = await getAiSetupPending();
    if (!pending) {
      return;
    }

    // Gate 3: Is it within the session window?
    const msSinceAiPrepare = Date.now() - pending.timestamp;
    if (msSinceAiPrepare > SESSION_TIMEOUT) {
      return;
    }

    // Don't fire evidence for ai-prepare itself (that's the command that creates the pending record)
    if (eventType === 'ai-prepare') {
      return;
    }

    // Check if preview file changed from baseline
    // Dynamic import to avoid pulling cli-storybook into core at module load
    const { hasPreviewChanged } = await import(
      '../../lib/cli-storybook/src/ai/setup-requirements.ts'
    );
    const previewChanged = await hasPreviewChanged(pending.configDir, {
      previewFile: pending.previewFile,
      previewHash: pending.previewHash,
    });

    // Check if doctor ran since ai-prepare
    const lastEvents = await getLastEvents();
    const doctorBoot = lastEvents['doctor'];
    const doctorRanSinceSetup = Boolean(
      doctorBoot && doctorBoot.timestamp > pending.timestamp
    );

    // aiAuthoredStories will be 0 here — enriched later in doTelemetry for dev/build
    await telemetry(
      'ai-setup-evidence',
      {
        trigger: eventType,
        msSinceAiPrepare,
        evidence: {
          previewChanged,
          aiAuthoredStories: 0,
          doctorRanSinceSetup,
        },
        traits: pending.traits,
      },
      {
        immediate: true,
        configDir: options.cliOptions.configDir || options.presetOptions?.configDir,
      }
    );
  } catch {
    // Evidence collection is best-effort — never block the actual command
  }
}
```

**Important note on the dynamic import**: The `hasPreviewChanged` import path (`../../lib/cli-storybook/src/ai/setup-requirements.ts`) is a cross-package import. During implementation, verify this resolves correctly. If it doesn't, we have two alternatives:
(a) Move `hasPreviewChanged` and `snapshotPreviewFile` to a shared location in `code/core/src/telemetry/` and have setup-requirements.ts re-export them.
(b) Inline the hash comparison logic in `withTelemetry.ts` directly (it's only ~10 lines).

Option (b) is simpler and avoids the cross-package import entirely. If the dynamic import doesn't work, use this inline approach instead:

```ts
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { findConfigFile } from 'storybook/internal/common';

async function checkPreviewChanged(
  configDir: string,
  baselineFile: string | null,
  baselineHash: string | null
): Promise<boolean> {
  const currentPath = findConfigFile('preview', configDir);
  if (currentPath !== baselineFile) return true;
  if (!currentPath) return false;
  try {
    const content = await readFile(currentPath, 'utf-8');
    const hash = createHash('sha256').update(content).digest('hex');
    return hash !== baselineHash;
  } catch {
    return baselineHash !== null;
  }
}
```

- [ ] **Step 3: Hook evidence collection into `withTelemetry`**

In the `withTelemetry` function (line 161-217), add the evidence collection call after the boot event. Find this block (around line 184-186):

```ts
  if (enableTelemetry) {
    telemetry('boot', { eventType }, { stripMetadata: true });
  }
```

Add after it:

```ts
  if (enableTelemetry) {
    // Fire-and-forget: don't await, don't block the command
    collectAiSetupEvidence(eventType, options).catch(() => {});
  }
```

- [ ] **Step 4: (Optional) Enrich aiAuthoredStories for dev events in doTelemetry**

In `code/core/src/core-server/utils/doTelemetry.ts`, after the story index is available, we can fire a second evidence event with the actual `aiAuthoredStories` count. This is optional for the initial implementation — the evidence from `withTelemetry` already captures preview changes and doctor status.

If implementing: after the `storyIndex` is computed (around line 50-54), import `isStoryAIGenerated` and count matching stories:

```ts
// Only if there's a pending ai-setup record
const pending = await getAiSetupPending();
if (pending && detectAgent()) {
  const { isStoryAIGenerated } = await import(
    '../../../lib/cli-storybook/src/ai/setup-requirements.ts'
  );
  let aiAuthoredStories = 0;
  if (storyIndex?.entries) {
    for (const entry of Object.values(storyIndex.entries)) {
      if (isStoryAIGenerated(entry)) {
        aiAuthoredStories++;
      }
    }
  }
  // Fire enriched evidence with actual story count
  if (aiAuthoredStories > 0) {
    const msSinceAiPrepare = Date.now() - pending.timestamp;
    if (msSinceAiPrepare <= SESSION_TIMEOUT) {
      const lastEvents = await getLastEvents();
      const doctorBoot = lastEvents['doctor'];
      const previewChanged = await checkPreviewChanged(
        pending.configDir, pending.previewFile, pending.previewHash
      );
      telemetry('ai-setup-evidence', {
        trigger: 'dev',
        msSinceAiPrepare,
        evidence: {
          previewChanged,
          aiAuthoredStories,
          doctorRanSinceSetup: Boolean(doctorBoot && doctorBoot.timestamp > pending.timestamp),
        },
        traits: pending.traits,
      });
    }
  }
}
```

This approach fires evidence from `withTelemetry` (early, without story count) and optionally enriches it from `doTelemetry` (later, with story count). Both events have the same `trigger: 'dev'` — Metabase can use `aiAuthoredStories > 0` to distinguish the enriched one.

**Implementation note**: During implementation, decide whether to:
(a) Fire from both `withTelemetry` and `doTelemetry` (simple, produces 2 events for dev)
(b) Skip the `withTelemetry` evidence for `dev`/`build` events and only fire from `doTelemetry` (cleaner, 1 event)

Option (b) is cleaner. To implement it, add a guard in `collectAiSetupEvidence`:
```ts
// Skip for dev/build — these are handled in doTelemetry with story index access
if (eventType === 'dev' || eventType === 'build') {
  return;
}
```

- [ ] **Step 5: Verify compilation**

Run: `yarn nx run-many -t compile`

Expected: No errors.

- [ ] **Step 6: Write tests for evidence collection**

Create test cases that verify:
1. Evidence is NOT collected when no agent is detected
2. Evidence is NOT collected when no pending record exists
3. Evidence is NOT collected when pending record is older than 2h
4. Evidence IS collected when all gates pass — verify payload shape
5. `previewChanged` correctly detects hash differences
6. `isStoryAIGenerated` correctly identifies AI-authored stories by title prefix

- [ ] **Step 7: Run tests**

Run: `yarn vitest run code/core/src/core-server/withTelemetry.test.ts --reporter=verbose`

(If this test file doesn't exist, create it or add to an existing test file.)

- [ ] **Step 8: Commit**

```bash
git add code/core/src/core-server/withTelemetry.ts code/core/src/core-server/utils/doTelemetry.ts code/core/src/telemetry/event-cache.ts code/core/src/telemetry/index.ts
git commit -m "feat(telemetry): add evidence-based ai-setup completion tracking at CLI entry points"
```

---

## Task 6: Add `@storybook/addon-mcp` to satellite addons

**Files:**
- Modify: `code/core/src/common/satellite-addons.ts`

- [ ] **Step 1: Add the addon**

In `code/core/src/common/satellite-addons.ts`, add `'@storybook/addon-mcp'` to the array. Add it after `'@storybook/addon-webpack5-compiler-swc'` and before the React Native comment:

```ts
  '@storybook/addon-webpack5-compiler-swc',
  '@storybook/addon-mcp',
  // Storybook for React Native related packages
```

- [ ] **Step 2: Verify compilation**

Run: `yarn nx compile storybook`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/common/satellite-addons.ts
git commit -m "feat: add @storybook/addon-mcp to satellite addons"
```

---

## Task 7: Ghost stories — remove modal trigger

**Files:**
- Modify: `code/core/src/manager/components/sidebar/CreateNewStoryFileModal.tsx`

- [ ] **Step 1: Remove the ghost stories code from the modal**

In `code/core/src/manager/components/sidebar/CreateNewStoryFileModal.tsx`:

1. Remove the `hasRunGhostStoriesFlow` ref (line 49):
   ```ts
   const hasRunGhostStoriesFlow = useRef(false);
   ```

2. Remove the `executeGhostStoriesFlow` callback (lines 177-180):
   ```ts
   const executeGhostStoriesFlow = useCallback(async () => {
     const channel = addons.getChannel();
     channel.emit(GHOST_STORIES_REQUEST);
   }, []);
   ```

3. Remove the useEffect that triggers it (lines 182-187):
   ```ts
   useEffect(() => {
     if (open && isRendererReact && !hasRunGhostStoriesFlow.current) {
       hasRunGhostStoriesFlow.current = true;
       executeGhostStoriesFlow();
     }
   }, [open, executeGhostStoriesFlow]);
   ```

4. Clean up now-unused imports. Check if `GHOST_STORIES_REQUEST` is still used elsewhere in the file. If not, remove its import. Same for `useRef` if no other refs remain, and `useCallback` if no other callbacks remain.

- [ ] **Step 2: Verify compilation**

Run: `yarn nx compile storybook`

Expected: No errors. There may be warnings about unused imports if you missed cleaning them up — fix those.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/manager/components/sidebar/CreateNewStoryFileModal.tsx
git commit -m "refactor(ghost-stories): remove modal-based trigger"
```

---

## Task 8: Ghost stories — add manager-side trigger hook

**Files:**
- Create: `code/core/src/manager/components/sidebar/useGhostStoriesTrigger.ts`
- Modify: `code/core/src/manager/components/sidebar/Sidebar.tsx`

- [ ] **Step 1: Create the trigger hook**

Create `code/core/src/manager/components/sidebar/useGhostStoriesTrigger.ts`:

```ts
import { useEffect, useRef } from 'react';

import { GHOST_STORIES_REQUEST, PREVIEW_INITIALIZED } from 'storybook/internal/core-events';
import { useStorybookApi } from 'storybook/manager-api';

/** Delay before firing ghost stories after PREVIEW_INITIALIZED (10 minutes). */
const TRIGGER_DELAY_MS = 10 * 60 * 1000;

/**
 * Fires a one-time GHOST_STORIES_REQUEST event 10 minutes after the preview
 * initializes. The server-side handler in ghost-stories-channel.ts enforces
 * the once-ever-per-project gate via lastEvents cache, so this hook is
 * fire-and-forget.
 *
 * Call this hook once at the top of the Sidebar component.
 */
export function useGhostStoriesTrigger(): void {
  const api = useStorybookApi();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const fire = () => {
      if (fired.current) {
        return;
      }
      fired.current = true;
      api.emit(GHOST_STORIES_REQUEST);
    };

    const onInit = () => {
      timeoutId = setTimeout(fire, TRIGGER_DELAY_MS);
    };

    api.once(PREVIEW_INITIALIZED, onInit);

    return () => {
      api.off(PREVIEW_INITIALIZED, onInit);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [api]);
}
```

- [ ] **Step 2: Call the hook from Sidebar**

In `code/core/src/manager/components/sidebar/Sidebar.tsx`:

Add the import (after the other local imports, around line 28):

```ts
import { useGhostStoriesTrigger } from './useGhostStoriesTrigger.ts';
```

Add the hook call inside the `Sidebar` component, after the existing `useLandmark` call (around line 138) and before the `isPagesShown` variable:

```ts
  useGhostStoriesTrigger();
```

- [ ] **Step 3: Verify compilation**

Run: `yarn nx compile storybook`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add code/core/src/manager/components/sidebar/useGhostStoriesTrigger.ts code/core/src/manager/components/sidebar/Sidebar.tsx
git commit -m "feat(ghost-stories): add 10min delayed trigger after PREVIEW_INITIALIZED"
```

---

## Task 9: Ghost stories — simplify server-side gate

**Files:**
- Modify: `code/core/src/core-server/server-channel/ghost-stories-channel.ts`

- [ ] **Step 1: Simplify the gating logic**

In `code/core/src/core-server/server-channel/ghost-stories-channel.ts`, find the gating logic inside the `GHOST_STORIES_REQUEST` handler (around lines 39-49):

Replace this block:
```ts
      const sessionId = await getSessionId();
      const lastGhostStoriesRun = lastEvents['ghost-stories'];
      if (
        lastGhostStoriesRun ||
        (lastInit.body?.sessionId && lastInit.body.sessionId !== sessionId)
      ) {
        return;
      }
```

With this simpler gate:
```ts
      const lastGhostStoriesRun = lastEvents['ghost-stories'];
      if (lastGhostStoriesRun) {
        return; // Already ran once for this project — never run again
      }
```

Also remove the `getSessionId` import if it's no longer used elsewhere in the file. Check the import line:
```ts
import {
  getLastEvents,
  getSessionId,        // <-- remove if unused
  getStorybookMetadata,
  telemetry,
} from 'storybook/internal/telemetry';
```

- [ ] **Step 2: Verify compilation**

Run: `yarn nx compile storybook`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/core-server/server-channel/ghost-stories-channel.ts
git commit -m "refactor(ghost-stories): simplify to once-ever gate using lastEvents cache"
```

---

## Task 10: Create mock telemetry receiver

**Files:**
- Create: `scripts/mock-telemetry-receiver.ts`

- [ ] **Step 1: Create the receiver script**

Create `scripts/mock-telemetry-receiver.ts`:

```ts
#!/usr/bin/env node

/**
 * Mock telemetry receiver for local development and testing.
 *
 * Usage:
 *   node scripts/mock-telemetry-receiver.ts
 *
 * Then point Storybook at it:
 *   STORYBOOK_TELEMETRY_URL=http://localhost:6007/event-log yarn storybook
 *
 * Endpoints:
 *   POST /event-log   — receives telemetry events (logs + stores)
 *   GET  /events      — returns all received events as JSON array
 *   GET  /events/:type — returns events filtered by eventType
 */

import { createServer } from 'node:http';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const PORT = Number(process.env.PORT || 6007);
const LOG_DIR = resolve(process.env.LOG_DIR || '.cache/telemetry-debug');
const events: Array<{ receivedAt: string; [key: string]: unknown }> = [];

await mkdir(LOG_DIR, { recursive: true });

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/event-log') {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const entry = { receivedAt: new Date().toISOString(), ...data };
        events.push(entry);
        // eslint-disable-next-line no-console
        console.log(`\n[telemetry] ${data.eventType || 'unknown'}`);
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(data, null, 2));
        await writeFile(
          resolve(LOG_DIR, `events-${new Date().toISOString().slice(0, 10)}.jsonl`),
          JSON.stringify(entry) + '\n',
          { flag: 'a' }
        );
        res.statusCode = 200;
        res.end('ok');
      } catch {
        res.statusCode = 400;
        res.end('bad json');
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/events')) {
    const typeFilter = req.url.split('/events/')[1];
    const filtered = typeFilter
      ? events.filter((e) => e.eventType === typeFilter)
      : events;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(filtered));
    return;
  }

  res.statusCode = 404;
  res.end('not found');
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock telemetry receiver listening on http://localhost:${PORT}/event-log`);
  // eslint-disable-next-line no-console
  console.log(`GET http://localhost:${PORT}/events to see all received events`);
  // eslint-disable-next-line no-console
  console.log(`GET http://localhost:${PORT}/events/<type> to filter by event type`);
  // eslint-disable-next-line no-console
  console.log(`Logs in ${LOG_DIR}`);
});
```

- [ ] **Step 2: Verify it starts**

Run: `timeout 3 node scripts/mock-telemetry-receiver.ts || true`

Expected: Should print the listening message and exit after timeout.

- [ ] **Step 3: Commit**

```bash
git add scripts/mock-telemetry-receiver.ts
git commit -m "feat: add mock telemetry receiver for local debugging"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run full compilation**

Run: `yarn nx run-many -t compile`

Expected: All packages compile successfully.

- [ ] **Step 2: Run type checks**

Run: `yarn nx run-many -t check`

Expected: No type errors.

- [ ] **Step 3: Run unit tests**

Run: `yarn vitest run code/core/src/telemetry/storybook-metadata.test.ts --reporter=verbose`

Expected: All tests pass, including the new agent-in-CI test.

- [ ] **Step 4: Run broader test suite**

Run: `yarn test`

Expected: No regressions.

- [ ] **Step 5: Lint changed files**

Run the linter on all changed files:
```bash
yarn --cwd code lint:js:cmd src/telemetry/storybook-metadata.ts --fix
yarn --cwd code lint:js:cmd src/telemetry/types.ts --fix
yarn --cwd code lint:js:cmd src/common/satellite-addons.ts --fix
yarn --cwd code lint:js:cmd src/manager/components/sidebar/CreateNewStoryFileModal.tsx --fix
yarn --cwd code lint:js:cmd src/manager/components/sidebar/Sidebar.tsx --fix
yarn --cwd code lint:js:cmd src/manager/components/sidebar/useGhostStoriesTrigger.ts --fix
yarn --cwd code lint:js:cmd src/core-server/server-channel/ghost-stories-channel.ts --fix
```

For cli-storybook files:
```bash
yarn --cwd code lint:js:cmd ../lib/cli-storybook/src/ai/types.ts --fix
yarn --cwd code lint:js:cmd ../lib/cli-storybook/src/ai/prompt.ts --fix
yarn --cwd code lint:js:cmd ../lib/cli-storybook/src/ai/index.ts --fix
yarn --cwd code lint:js:cmd ../lib/cli-storybook/src/bin/run.ts --fix
```

Expected: No unfixable lint errors.

- [ ] **Step 6: Final commit if lint made changes**

```bash
git add -A
git status
# If there are lint-fixed changes:
git commit -m "chore: lint fixes"
```
