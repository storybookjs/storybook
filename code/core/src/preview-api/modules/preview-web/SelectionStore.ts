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

  /** The URL of the preview that shows the current selection, if the store keeps one. */
  url?: string;

  setSelection(selection: Selection): void;

  setQueryParams(queryParams: Record<PropertyKey, unknown>): void;
}
