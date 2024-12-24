import type { Args, StoryId, ViewMode } from '@storybook/core/types';

import type { StorySpecifier } from '../store/StoryIndexStore';

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
}
