import type { StoreOptions } from '../universal-store/types.ts';

// Whether the user dismissed the sidebar hint that they can ask their agent for a UI review. The
// server keeps it in the user settings on disk (`reviewHint` in `~/.storybook/settings.json`), so it
// holds across projects and ports.
export type ReviewHintStoreState = {
  dismissedAt?: number;
  // False until the server has read the user settings.
  loaded?: boolean;
};

export const UNIVERSAL_REVIEW_HINT_STORE_OPTIONS: StoreOptions<ReviewHintStoreState> = {
  id: 'storybook/review-hint',
  initialState: {},
} as const;
