import { flushAiSetupPending, getAiSetupPending } from './event-cache.ts';
import { SESSION_TIMEOUT } from './session-id.ts';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { findConfigFile } from 'storybook/internal/common';
import { detectAgent } from './detect-agent.ts';
import { telemetry } from './index.ts';
import type { EventType } from './types.ts';
import type { IndexEntry, StoryIndex } from 'storybook/internal/types';

/**
 * Determines whether a story index entry was authored by the `sb ai setup` flow.
 * Currently checks title prefix. When we migrate to a tag-based approach,
 * swap this to check for the tag instead — this is the single swap point.
 */
export function isStoryCreatedByAISetup(entry: IndexEntry): boolean {
  return entry.type === 'story' && (entry.tags?.includes('ai-generated') ?? false);
}

/**
 * Count stories in the index that were created by `sb ai setup`.
 */
export function countAiAuthoredStories(storyIndex: StoryIndex): number {
  return Object.values(storyIndex.entries).filter(isStoryCreatedByAISetup).length;
}

/**
 * Snapshot the preview file state for baseline comparison.
 * Returns the filename and SHA-256 hash, or nulls if no preview file exists.
 */
export async function snapshotPreviewFile(
  configDir: string
): Promise<{ previewPath: string | null; previewHash: string | null }> {
  const previewPath = findConfigFile('preview', configDir);
  if (!previewPath) {
    return { previewPath: null, previewHash: null };
  }

  try {
    const content = await readFile(previewPath, 'utf-8');
    const hash = createHash('sha256').update(content).digest('hex');
    return { previewPath, previewHash: hash };
  } catch {
    // File found by findConfigFile but unreadable — treat as absent
    return { previewPath, previewHash: null };
  }
}

/**
 * Check whether the preview file has changed from an ai-setup baseline.
 * Returns true if: hash differs, file appeared, file disappeared, or file is unreadable.
 */
export async function checkPreviewChanged(
  configDir: string,
  baseline: { previewPath: string | null; previewHash: string | null }
): Promise<boolean> {
  const currentPath = findConfigFile('preview', configDir);
  if (currentPath !== baseline.previewPath) {
    return true;
  }
  if (!currentPath) {
    return false;
  }
  try {
    const content = await readFile(currentPath, 'utf-8');
    const hash = createHash('sha256').update(content).digest('hex');
    return hash !== baseline.previewHash;
  } catch {
    // File unreadable — treat as changed because we expected it to be readable post init
    return true;
  }
}

/**
 * Check for a pending ai-setup record and fire an evidence event if found.
 *
 * Called from:
 * - `withTelemetry` after the boot event for non-dev/build CLI commands (no story index)
 * - `doTelemetry` for dev/build commands (story index available)
 *
 * Gated on: agent detected → pending record exists → within session window → configDir matches.
 */
export async function collectAiSetupEvidence(
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

    // Gate 2: Is there a pending ai-setup record?
    const pending = await getAiSetupPending();
    if (!pending) {
      return;
    }

    // Gate 3: Does the configDir match? (cross-project guard)
    if (configDir && pending.configDir !== resolve(configDir)) {
      return;
    }

    // Gate 4: Is it within the session window?
    const timeSinceSetup = Date.now() - pending.timestamp;
    if (timeSinceSetup > SESSION_TIMEOUT) {
      // Session expired, clean up pending record.
      await flushAiSetupPending();
      return;
    }

    // Don't fire evidence for ai-setup itself — the setup command gives the
    // prompt to the agent and exits, so we only expect changes after the agent
    // has started processing it.
    if (eventType === 'ai-setup') {
      return;
    }

    await telemetry(
      'ai-setup-evidence',
      async () => {
        // Check if preview file changed from baseline
        const previewChanged = await checkPreviewChanged(pending.configDir, pending);

        // Count AI-authored stories if story index is available
        const aiAuthoredStories = storyIndex ? countAiAuthoredStories(storyIndex) : undefined;

        return {
          previewChanged,
          aiAuthoredStories,
          sessionId: pending.sessionId,
          timeSinceSetup,
        };
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
