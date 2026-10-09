import path from 'node:path';

import { normalizeStoryPath } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf/csf-utils';
import type { IndexEntry, StoryIndex } from 'storybook/internal/types';

import leven from 'leven';

import type { StoryInput } from './story-input.ts';

export interface FoundStory {
  /** The matched index entry — carrying it proves the id exists in the index. */
  entry: IndexEntry;
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

const MAX_SUGGESTIONS = 3;
const MAX_FILE_STORIES = 5;

// Agents guess IDs from story names (`--error` for an `ErrorState` story named "Error"), so the
// same component's stories come first, those whose name overlaps the guess before the rest.
function suggestStoryIds(entries: IndexEntry[], storyId: string): string[] {
  const [componentId, storyName = ''] = storyId.split('--');
  return entries
    .filter((entry) => entry.type === 'story')
    .map((entry) => {
      const [entryComponentId, entryStoryName = ''] = entry.id.split('--');
      const sameComponent = entryComponentId === componentId;
      return {
        id: entry.id,
        sameComponent,
        overlapsGuess:
          sameComponent &&
          storyName !== '' &&
          entryStoryName !== '' &&
          (entryStoryName.includes(storyName) || storyName.includes(entryStoryName)),
        distance: leven(storyId, entry.id),
      };
    })
    .filter(({ sameComponent, distance }) => sameComponent || distance <= storyId.length / 3)
    .sort(
      (a, b) =>
        Number(b.sameComponent) - Number(a.sameComponent) ||
        Number(b.overlapsGuess) - Number(a.overlapsGuess) ||
        a.distance - b.distance
    )
    .slice(0, MAX_SUGGESTIONS)
    .map(({ id }) => `"${id}"`);
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
          entry: foundEntry,
          input: storyInput,
        });
      } else {
        const suggestions = suggestStoryIds(entriesList, storyInput.storyId);
        result.push({
          input: storyInput,
          errorMessage:
            `No story found for story ID "${storyInput.storyId}"` +
            (suggestions.length > 0 ? `. Did you mean ${suggestions.join(', ')}?` : ''),
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

    const fileEntries = entriesList.filter(
      (entry) => entry.type === 'story' && normalizeImportPath(entry.importPath) === relativePath
    );
    const foundEntry = fileEntries.find((entry) =>
      [explicitStoryName, storyNameFromExport(exportName)].includes(entry.name)
    );

    if (foundEntry) {
      result.push({
        entry: foundEntry,
        input: storyInput,
      });
    } else {
      let errorMessage = `No story found for export name "${exportName}" with absolute file path "${absoluteStoryPath}"`;
      if (fileEntries.length > 0) {
        const guessedName = explicitStoryName ?? storyNameFromExport(exportName);
        const closest = fileEntries
          .toSorted((a, b) => leven(guessedName, a.name) - leven(guessedName, b.name))
          .slice(0, MAX_FILE_STORIES);
        const more =
          fileEntries.length > closest.length
            ? ` (+${fileEntries.length - closest.length} more)`
            : '';
        errorMessage += `. Closest stories in that file: ${closest
          .map((entry) => `"${entry.id}" (named "${entry.name}")`)
          .join(', ')}${more}. Pass one of these IDs as { storyId } instead`;
      } else if (!explicitStoryName) {
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
