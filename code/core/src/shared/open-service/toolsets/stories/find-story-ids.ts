import path from 'node:path';

import { normalizeStoryPath } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf/csf-utils';
import type { IndexEntry, StoryIndex, StoryIndexEntry } from 'storybook/internal/types';

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

function isNonTestStory(entry: IndexEntry): entry is StoryIndexEntry {
  return entry.type === 'story' && entry.subtype !== 'test';
}

// Agents guess IDs from story names (`--error` for an `ErrorState` story named "Error"), so the
// same component's stories come first, those whose name overlaps the guess before the rest. A
// guess without the title prefix (`button--primary` for `example-button--primary`) counts as the
// same component.
function suggestStoryIds(entries: IndexEntry[], storyId: string): string[] {
  const [componentId, guessedSlug = ''] = storyId.split('--');
  const maxDistance = storyId.length / 3;
  return entries
    .filter(isNonTestStory)
    .flatMap((entry) => {
      const [entryComponentId, entrySlug = ''] = entry.id.split('--');
      // 2: the guessed component, 1: the guessed component under a title prefix, 0: another one.
      const componentMatch =
        entryComponentId === componentId ? 2 : entryComponentId.endsWith(`-${componentId}`) ? 1 : 0;
      const sameComponent = componentMatch > 0;
      if (!sameComponent && Math.abs(entry.id.length - storyId.length) > maxDistance) {
        return [];
      }
      const distance = leven(storyId, entry.id);
      if (!sameComponent && distance > maxDistance) {
        return [];
      }
      const overlapsGuess =
        sameComponent &&
        guessedSlug !== '' &&
        entrySlug !== '' &&
        (entrySlug.includes(guessedSlug) || guessedSlug.includes(entrySlug));
      return [{ id: entry.id, componentMatch, overlapsGuess, distance }];
    })
    .sort(
      (a, b) =>
        b.componentMatch - a.componentMatch ||
        Number(b.overlapsGuess) - Number(a.overlapsGuess) ||
        a.distance - b.distance
    )
    .slice(0, MAX_SUGGESTIONS)
    .map(({ id }) => id);
}

function describeClosestFileStories(fileStories: StoryIndexEntry[], guessedName: string): string {
  const closest = fileStories
    .map((entry) => ({ entry, distance: leven(guessedName, entry.name) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_FILE_STORIES)
    .map(({ entry }) => `"${entry.id}" (named "${entry.name}")`);
  const more =
    fileStories.length > closest.length ? ` (+${fileStories.length - closest.length} more)` : '';
  return `Closest stories in that file: ${closest.join(', ')}${more}. Pass one of these IDs as { storyId } instead`;
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
            (suggestions.length > 0
              ? `. Did you mean ${suggestions.map((id) => `"${id}"`).join(', ')}?`
              : ''),
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

    // Test entries carry their parent story's export name and can share a story's name.
    const fileStories = entriesList.filter(
      (entry): entry is StoryIndexEntry =>
        isNonTestStory(entry) && normalizeImportPath(entry.importPath) === relativePath
    );
    const foundEntry =
      fileStories.find((entry) => entry.exportName === exportName) ??
      fileStories.find((entry) =>
        [explicitStoryName, storyNameFromExport(exportName)].includes(entry.name)
      );

    if (foundEntry) {
      result.push({
        entry: foundEntry,
        input: storyInput,
      });
    } else {
      const hint =
        fileStories.length > 0
          ? describeClosestFileStories(
              fileStories,
              explicitStoryName ?? storyNameFromExport(exportName)
            )
          : 'Storybook has no stories indexed for that file; check the path, and that the file matches the `stories` globs in the Storybook config';
      result.push({
        input: storyInput,
        errorMessage: `No story found for export name "${exportName}" with absolute file path "${absoluteStoryPath}". ${hint}`,
      });
    }
  }

  return result;
}
