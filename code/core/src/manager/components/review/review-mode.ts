import type { StatusValue } from 'storybook/internal/types';
import type { API } from 'storybook/manager-api';

import { REVIEW_NAMESPACE } from '../../../shared/review/index.ts';
import { REVIEWING_STATUS_VALUE } from './review-status.ts';
import { sessionStore } from './session-store.ts';

// Persisted flag marking the manager as being in review mode. Review mode is
// interaction-driven (never inferred from the URL) and survives reloads via
// this key.
const REVIEW_MODE_SESSION_KEY = `${REVIEW_NAMESPACE}/review-mode`;

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

/** Whether the manager is currently in review mode (persisted across reloads). */
export const isReviewModeActive = (): boolean => sessionStore.read(REVIEW_MODE_SESSION_KEY) === '1';

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
  filters: ReviewModeFilters
): Promise<void> => {
  if (isReviewModeActive()) {
    return;
  }

  sessionStore.write(
    FILTERS_SNAPSHOT_SESSION_KEY,
    JSON.stringify(stripReviewingStatusFilter(filters))
  );

  try {
    await api.setAllTagFilters([], []);
    await api.setAllStatusFilters([REVIEWING_STATUS_VALUE], []);
    sessionStore.write(REVIEW_MODE_SESSION_KEY, '1');
  } catch (error) {
    sessionStore.remove(FILTERS_SNAPSHOT_SESSION_KEY);
    throw error;
  }
};

/**
 * Exit review mode: restore the filters captured on entry and clear the
 * persisted review-mode flag.
 */
export const exitReviewMode = async (api: ReviewModeApi): Promise<void> => {
  const filters = readJson<ReviewModeFilters>(FILTERS_SNAPSHOT_SESSION_KEY);
  if (filters) {
    const restored = stripReviewingStatusFilter(filters);
    await api.setAllTagFilters(restored.includedTagFilters, restored.excludedTagFilters);
    await api.setAllStatusFilters(restored.includedStatusFilters, restored.excludedStatusFilters);
  } else {
    await api.removeStatusFilters([REVIEWING_STATUS_VALUE]);
  }

  sessionStore.remove(FILTERS_SNAPSHOT_SESSION_KEY);
  sessionStore.remove(REVIEW_MODE_SESSION_KEY);
};
