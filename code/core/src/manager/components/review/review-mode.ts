import type { API } from 'storybook/manager-api';
import type { StatusValue } from 'storybook/internal/types';

import { REVIEW_NAMESPACE } from '../../../shared/review/index.ts';
import { REVIEWING_STATUS_VALUE } from './review-status.ts';
import { sessionStore } from './session-store.ts';

// Persisted flag marking the manager as being in review mode. Review mode is
// interaction-driven (never inferred from the URL) and survives reloads via
// this key. See docs/adr/0001-interaction-driven-review-mode.md.
const REVIEW_MODE_SESSION_KEY = `${REVIEW_NAMESPACE}/review-mode`;

// Snapshot of the manager chrome (sidebar/addon panel visibility) taken when
// review mode is entered, so the exact pre-review layout can be restored on exit.
const CHROME_SNAPSHOT_SESSION_KEY = `${REVIEW_NAMESPACE}/chrome-snapshot`;

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

type ReviewModeApi = Pick<
  API,
  | 'toggleNav'
  | 'togglePanel'
  | 'getIsNavShown'
  | 'getIsPanelShown'
  | 'setAllStatusFilters'
  | 'setAllTagFilters'
>;

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
 * Enter review mode: the single place chrome collapse and filter narrowing
 * happen. On the first entry it snapshots the current chrome and filters so
 * {@link exitReviewMode} can restore them. Idempotent: re-entering while already
 * in review mode re-applies the focused layout without overwriting the snapshot.
 */
export const enterReviewMode = async (
  api: ReviewModeApi,
  filters: ReviewModeFilters
): Promise<void> => {
  if (!isReviewModeActive()) {
    sessionStore.write(
      CHROME_SNAPSHOT_SESSION_KEY,
      JSON.stringify({
        nav: api.getIsNavShown(),
        panel: api.getIsPanelShown(),
      })
    );
    sessionStore.write(FILTERS_SNAPSHOT_SESSION_KEY, JSON.stringify(filters));
    sessionStore.write(REVIEW_MODE_SESSION_KEY, '1');
  }

  api.toggleNav(false);
  api.togglePanel(false);
  await api.setAllTagFilters([], []);
  await api.setAllStatusFilters([REVIEWING_STATUS_VALUE], []);
};

/**
 * Exit review mode: restore the chrome and filters captured on entry and clear
 * the persisted review-mode flag. Always restores the pre-review snapshot.
 */
export const exitReviewMode = async (api: ReviewModeApi): Promise<void> => {
  const chrome = readJson<{ nav: boolean; panel: boolean }>(CHROME_SNAPSHOT_SESSION_KEY);
  if (chrome?.nav) {
    api.toggleNav(true);
  }
  if (chrome?.panel) {
    api.togglePanel(true);
  }

  const filters = readJson<ReviewModeFilters>(FILTERS_SNAPSHOT_SESSION_KEY);
  if (filters) {
    await api.setAllTagFilters(filters.includedTagFilters, filters.excludedTagFilters);
    await api.setAllStatusFilters(filters.includedStatusFilters, filters.excludedStatusFilters);
  }

  sessionStore.remove(CHROME_SNAPSHOT_SESSION_KEY);
  sessionStore.remove(FILTERS_SNAPSHOT_SESSION_KEY);
  sessionStore.remove(REVIEW_MODE_SESSION_KEY);
};
