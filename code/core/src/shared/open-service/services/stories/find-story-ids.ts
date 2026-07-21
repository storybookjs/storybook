import path from 'node:path';

import { normalizeStoryPath } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import type { StoryIndex } from 'storybook/internal/types';

import type { StoryInput } from './story-input.ts';

export interface FoundStory {
  id: string;
  input: StoryInput;
}

export interface NotFoundStory {
  input: StoryInput;
  errorMessage: string;
}

export type FindStoryIdsResult = FoundStory | NotFoundStory;

function isStoryIdInput(input: StoryInput): input is StoryInput & { storyId: string } {
  return 'storyId' in input;
}

/** Normalize Windows separators the same way the `slash` package does. */
function toPosixPath(value: string): string {
  return value.startsWith('\\\\?\\') ? value : value.replace(/\\/g, '/');
}

// Keep normalization consistent with StoryIndexGenerator importPath handling.
function normalizeImportPath(importPath: string): string {
  const normalized = path.posix.normalize(toPosixPath(importPath));
  return toPosixPath(normalizeStoryPath(normalized));
}

/**
 * Finds story IDs in the story index that match the given story inputs.
 *
 * Returns per-input lookup results in the same order as `stories`.
 */
export function findStoryIds(index: StoryIndex, stories: StoryInput[]): FindStoryIdsResult[] {
  const entriesList = Object.values(index.entries);
  const result: FindStoryIdsResult[] = [];

  for (const storyInput of stories) {
    if (isStoryIdInput(storyInput)) {
      const foundEntry = index.entries[storyInput.storyId];

      if (foundEntry) {
        result.push({
          id: foundEntry.id,
          input: storyInput,
        });
      } else {
        result.push({
          input: storyInput,
          errorMessage: `No story found for story ID "${storyInput.storyId}"`,
        });
      }

      continue;
    }

    const { exportName, explicitStoryName, absoluteStoryPath } = storyInput;
    const normalizedCwd = toPosixPath(process.cwd());
    const normalizedAbsolutePath = toPosixPath(absoluteStoryPath);
    const relativePath = normalizeImportPath(
      path.posix.relative(normalizedCwd, normalizedAbsolutePath)
    );

    const foundEntry = entriesList.find(
      (entry) =>
        normalizeImportPath(entry.importPath) === relativePath &&
        [explicitStoryName, storyNameFromExport(exportName)].includes(entry.name)
    );

    if (foundEntry) {
      result.push({
        id: foundEntry.id,
        input: storyInput,
      });
    } else {
      let errorMessage = `No story found for export name "${exportName}" with absolute file path "${absoluteStoryPath}"`;
      if (!explicitStoryName) {
        errorMessage += ` (did you forget to pass the explicit story name?)`;
      }
      result.push({
        input: storyInput,
        errorMessage,
      });
    }
  }

  return result;
}
