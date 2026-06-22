import type { StatusValue } from 'storybook/internal/types';
import type { API } from 'storybook/manager-api';

/** Matches the `storybook/review` sessionStorage keys owned by the review module. */
const REVIEW_ADDON_ID = 'storybook/review';

// Persisted flag marking the manager as being in review mode. Review mode is
// interaction-driven (never inferred from the URL) and survives reloads via
// this key.
const REVIEW_MODE_SESSION_KEY = `${REVIEW_ADDON_ID}/review-mode`;

// Snapshot of the manager chrome (sidebar/addon panel visibility) taken when
// review mode is entered, so the exact pre-review layout can be restored on exit.
const CHROME_SNAPSHOT_SESSION_KEY = `${REVIEW_ADDON_ID}/chrome-snapshot`;

// Snapshot of the sidebar filters taken when review mode is entered, so the
// pre-review filters can be restored on exit.
const FILTERS_SNAPSHOT_SESSION_KEY = `${REVIEW_ADDON_ID}/filters-snapshot`;

const REVIEWING = 'status-value:reviewing' as StatusValue;

const sessionRead = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const sessionWrite = (key: string, value: string): void => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable.
  }
};

const sessionRemove = (key: string): void => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Storage unavailable.
  }
};

/** Sidebar filter snapshot preserved across a review-mode session. */
export interface ReviewModeFilters {
  includedStatusFilters: StatusValue[];
  excludedStatusFilters: StatusValue[];
  includedTagFilters: string[];
  excludedTagFilters: string[];
}

type ReviewModeApi = Partial<
  Pick<
    API,
    | 'toggleNav'
    | 'togglePanel'
    | 'getIsNavShown'
    | 'getIsPanelShown'
    | 'setAllStatusFilters'
    | 'setAllTagFilters'
  >
>;

/** Whether the manager is currently in review mode (persisted across reloads). */
export const isReviewModeActive = (): boolean => sessionRead(REVIEW_MODE_SESSION_KEY) === '1';

const readJson = <T>(key: string): T | null => {
  const raw = sessionRead(key);
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
    sessionWrite(
      CHROME_SNAPSHOT_SESSION_KEY,
      JSON.stringify({
        nav: api.getIsNavShown?.() ?? true,
        panel: api.getIsPanelShown?.() ?? true,
      })
    );
    sessionWrite(FILTERS_SNAPSHOT_SESSION_KEY, JSON.stringify(filters));
    sessionWrite(REVIEW_MODE_SESSION_KEY, '1');
  }

  api.toggleNav?.(false);
  api.togglePanel?.(false);
  await api.setAllTagFilters?.([], []);
  await api.setAllStatusFilters?.([REVIEWING], []);
};

/**
 * Exit review mode: restore the chrome and filters captured on entry and clear
 * the persisted review-mode flag. Always restores the pre-review snapshot.
 */
export const exitReviewMode = async (api: ReviewModeApi): Promise<void> => {
  const chrome = readJson<{ nav: boolean; panel: boolean }>(CHROME_SNAPSHOT_SESSION_KEY);
  if (chrome?.nav) {
    api.toggleNav?.(true);
  }
  if (chrome?.panel) {
    api.togglePanel?.(true);
  }

  const filters = readJson<ReviewModeFilters>(FILTERS_SNAPSHOT_SESSION_KEY);
  if (filters) {
    await api.setAllTagFilters?.(filters.includedTagFilters, filters.excludedTagFilters);
    await api.setAllStatusFilters?.(filters.includedStatusFilters, filters.excludedStatusFilters);
  }

  sessionRemove(CHROME_SNAPSHOT_SESSION_KEY);
  sessionRemove(FILTERS_SNAPSHOT_SESSION_KEY);
  sessionRemove(REVIEW_MODE_SESSION_KEY);
};
