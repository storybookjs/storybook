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
