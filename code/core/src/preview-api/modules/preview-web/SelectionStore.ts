import type { Args, StoryId, ViewMode } from 'storybook/internal/types';

import type { StorySpecifier } from '../store/StoryIndexStore.ts';

export interface SelectionSpecifier {
  storySpecifier: StorySpecifier;
  viewMode: ViewMode;
  args?: Args;
  globals?: Args;
}

export interface Selection {
  storyId: StoryId;
  viewMode: ViewMode;
}

export interface SelectionStore {
  selectionSpecifier: SelectionSpecifier | null;

  selection?: Selection;

  setSelection(selection: Selection): void;

  setQueryParams(queryParams: Record<PropertyKey, unknown>): void;

  /**
   * Lends `location` to a story that owns the document, while it is mounted: the store neither
   * reads nor writes `location`, and keeps the selection and query params to itself.
   */
  lendLocation?(): void;

  /**
   * Called after a story's teardown: writes the URL of the selection to `location` if it is not
   * there, sets the document's title, and reads and writes `location` again.
   */
  reclaimLocation?(): void;
}
