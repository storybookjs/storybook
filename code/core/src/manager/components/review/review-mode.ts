import type { StatusValue } from 'storybook/internal/types';
import type { API } from 'storybook/manager-api';

import { REVIEW_NAMESPACE } from '../../../shared/review/index.ts';
import { REVIEWING_STATUS_VALUE } from './review-status.ts';
import { sessionStore } from './session-store.ts';

// Snapshot of the sidebar filters taken when review mode is entered, so the
// pre-review filters can be restored on exit.
const FILTERS_SNAPSHOT_SESSION_KEY = `${REVIEW_NAMESPACE}/filters-snapshot`;

/** Sidebar filter snapshot preserved across a review-mode session. */
export interface ReviewModeFilters {
  includedStatusFilters: StatusValue[];
  excludedStatusFilters: StatusValue[];
  includedTagFilters: string[];
  excludedTagFilters: string[];
}

/**
 * Access to the per-tab review-mode flag, owned by ReviewProvider (which persists it so review mode
 * survives reloads). `isActive` is a fresh read, not a render-time snapshot, so rapid successive
 * entries stay idempotent.
 */
export interface ReviewModeHandle {
  isActive: () => boolean;
  setActive: (active: boolean) => void;
}

type ReviewModeApi = Pick<API, 'setAllStatusFilters' | 'setAllTagFilters' | 'removeStatusFilters'>;

/** Reviewing is owned by review mode and must never be restored after exit. */
const stripReviewingStatusFilter = (filters: ReviewModeFilters): ReviewModeFilters => ({
  ...filters,
  includedStatusFilters: filters.includedStatusFilters.filter(
    (value) => value !== REVIEWING_STATUS_VALUE
  ),
  excludedStatusFilters: filters.excludedStatusFilters.filter(
    (value) => value !== REVIEWING_STATUS_VALUE
  ),
});

const readJson = <T>(key: string): T | null => {
  const raw = sessionStore.read(key);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/**
 * Enter review mode: snapshot sidebar filters and narrow to reviewing stories.
 * Idempotent — re-entering while already in review mode is a no-op.
 */
export const enterReviewMode = async (
  api: ReviewModeApi,
  filters: ReviewModeFilters,
  mode: ReviewModeHandle
): Promise<void> => {
  if (mode.isActive()) {
    return;
  }

  sessionStore.write(
    FILTERS_SNAPSHOT_SESSION_KEY,
    JSON.stringify(stripReviewingStatusFilter(filters))
  );

  // Enter optimistically so the UI flips before the async filter setters land.
  mode.setActive(true);
  try {
    await api.setAllTagFilters([], []);
    await api.setAllStatusFilters([REVIEWING_STATUS_VALUE], []);
  } catch (error) {
    mode.setActive(false);
    sessionStore.remove(FILTERS_SNAPSHOT_SESSION_KEY);
    throw error;
  }
};

/**
 * Exit review mode: restore the filters captured on entry and clear the
 * review-mode flag.
 */
export const exitReviewMode = async (api: ReviewModeApi, mode: ReviewModeHandle): Promise<void> => {
  const filters = readJson<ReviewModeFilters>(FILTERS_SNAPSHOT_SESSION_KEY);
  if (filters) {
    const restored = stripReviewingStatusFilter(filters);
    await api.setAllTagFilters(restored.includedTagFilters, restored.excludedTagFilters);
    await api.setAllStatusFilters(restored.includedStatusFilters, restored.excludedStatusFilters);
  } else {
    await api.removeStatusFilters([REVIEWING_STATUS_VALUE]);
  }

  sessionStore.remove(FILTERS_SNAPSHOT_SESSION_KEY);
  mode.setActive(false);
};
