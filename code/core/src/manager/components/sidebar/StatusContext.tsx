import { createContext } from 'react';

import type { Status, StoryId } from 'storybook/internal/types';

/**
 * Status rollups for the tree rows. The tree computes them once and shares them here, so that a row
 * re-renders only when its own status changes.
 */
export const StatusContext = createContext<{
  groupDualStatus?: Record<StoryId, { test: Status; change: Status }>;
  /**
   * Whether the 'modified' status filter is active. The tree shows the modified change-status
   * icon only while it is.
   */
  isModifiedFilterActive?: boolean;
}>({});
