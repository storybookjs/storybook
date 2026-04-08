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
