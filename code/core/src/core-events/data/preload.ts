import type { StoryId } from 'storybook/internal/types';

export type PreloadSource = 'hover' | 'search' | 'sibling';

export interface PreloadEntriesPayload {
  ids: StoryId[];
  source?: PreloadSource;
  options?: { target?: string };
}
