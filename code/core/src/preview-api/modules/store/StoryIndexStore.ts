import memoize from 'memoizerific';
import { MissingStoryAfterHmrError } from '@storybook/core/preview-errors';
import type { ComponentTitle, Path, StoryId, StoryName } from '@storybook/core/types';
import type { IndexEntry, StoryIndex } from '@storybook/core/types';

export type StorySpecifier = StoryId | { name: StoryName; title: ComponentTitle } | '*';

const getImportPathMap = memoize(1)((entries: StoryIndex['entries']) =>
  Object.values(entries).reduce(
    (acc, entry) => {
      acc[entry.importPath] = acc[entry.importPath] || entry;
      return acc;
    },
    {} as Record<Path, IndexEntry>
  )
);

export class StoryIndexStore {
  entries: StoryIndex['entries'];

  constructor({ entries }: StoryIndex = { v: 5, entries: {} }) {
    this.entries = entries;
  }

  entryFromSpecifier(specifier: StorySpecifier) {
    const entries = Object.values(this.entries);
    if (specifier === '*') {
      // '*' means select the first entry. If there is none, we have no selection.
      return entries[0];
    }

    if (typeof specifier === 'string') {
      // Find the story with the exact id that matches the specifier (see #11571)
      if (this.entries[specifier]) {
        return this.entries[specifier];
      }
      // Fallback to the first story that starts with the specifier
      return entries.find((entry) => entry.id.startsWith(specifier));
    }

    // Try and find a story matching the name/kind, setting no selection if they don't exist.
    const { name, title } = specifier;
    return entries.find((entry) => entry.name === name && entry.title === title);
  }

  storyIdToEntry(storyId: StoryId): IndexEntry {
    const storyEntry = this.entries[storyId];
    if (!storyEntry) {
      throw new MissingStoryAfterHmrError({ storyId });
    }

    return storyEntry;
  }

  importPathToEntry(importPath: Path): IndexEntry {
    return getImportPathMap(this.entries)[importPath];
  }
}
