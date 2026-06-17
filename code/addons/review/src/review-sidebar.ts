import { RESTORE_NAV_SESSION_KEY, RESTORE_PANEL_SESSION_KEY } from './constants.ts';
import { sessionStore } from './session-store.ts';

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

  if (sessionStore.read(RESTORE_NAV_SESSION_KEY) === null) {
    sessionStore.write(RESTORE_NAV_SESSION_KEY, isNavShown ? 'restore' : 'keep');
  }
  if (sessionStore.read(RESTORE_PANEL_SESSION_KEY) === null) {
    sessionStore.write(RESTORE_PANEL_SESSION_KEY, isPanelShown ? 'restore' : 'keep');
  }
  api.toggleNav?.(false);
  api.togglePanel?.(false);
};

/** Show the manager sidebar and addon panel when leaving the review summary. */
export const openReviewSidebar = (api: ReviewChromeApi) => {
  const restoreNav = sessionStore.read(RESTORE_NAV_SESSION_KEY) === 'restore';
  const restorePanel = sessionStore.read(RESTORE_PANEL_SESSION_KEY) === 'restore';
  if (restoreNav) {
    api.toggleNav?.(true);
  }
  if (restorePanel) {
    api.togglePanel?.(true);
  }
  sessionStore.remove(RESTORE_NAV_SESSION_KEY);
  sessionStore.remove(RESTORE_PANEL_SESSION_KEY);
};
