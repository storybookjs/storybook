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
