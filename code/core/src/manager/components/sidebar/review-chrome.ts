import type { API } from 'storybook/manager-api';
import type { StatusValue } from 'storybook/internal/types';

/** Matches `@storybook/addon-review` sessionStorage keys. */
const REVIEW_ADDON_ID = 'storybook/addon-review';
const RESTORE_NAV_SESSION_KEY = `${REVIEW_ADDON_ID}/restore-nav`;
const RESTORE_PANEL_SESSION_KEY = `${REVIEW_ADDON_ID}/restore-panel`;

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

type ReviewChromeApi = {
  toggleNav?: (shown?: boolean) => void;
  togglePanel?: (shown?: boolean) => void;
  getIsNavShown?: () => boolean;
  getIsPanelShown?: () => boolean;
};

/** Hide the manager sidebar and addon panel when entering a review session. */
export const collapseReviewChrome = (api: ReviewChromeApi) => {
  const isNavShown = api.getIsNavShown?.() ?? true;
  const isPanelShown = api.getIsPanelShown?.() ?? true;

  if (sessionRead(RESTORE_NAV_SESSION_KEY) === null) {
    sessionWrite(RESTORE_NAV_SESSION_KEY, isNavShown ? 'restore' : 'keep');
  }
  if (sessionRead(RESTORE_PANEL_SESSION_KEY) === null) {
    sessionWrite(RESTORE_PANEL_SESSION_KEY, isPanelShown ? 'restore' : 'keep');
  }
  api.toggleNav?.(false);
  api.togglePanel?.(false);
};

type ReviewFilterApi = Pick<API, 'setAllStatusFilters' | 'setAllTagFilters'>;

/** Filter the sidebar to stories marked as reviewing in the active review. */
export const applyReviewingStoryFilter = async (api: ReviewFilterApi) => {
  if (typeof api.setAllTagFilters === 'function') {
    await api.setAllTagFilters([], []);
  }
  if (typeof api.setAllStatusFilters === 'function') {
    await api.setAllStatusFilters([REVIEWING], []);
  }
};
