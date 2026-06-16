import type { API } from 'storybook/manager-api';

import { RESTORE_NAV_SESSION_KEY, RESTORE_PANEL_SESSION_KEY } from './constants.ts';
import { sessionStore } from './session-store.ts';

/** Show the manager sidebar and addon panel when leaving the review summary. */
export const openReviewSidebar = (api: Pick<API, 'toggleNav' | 'togglePanel'>) => {
  api.toggleNav(true);
  api.togglePanel(true);
  sessionStore.remove(RESTORE_NAV_SESSION_KEY);
  sessionStore.remove(RESTORE_PANEL_SESSION_KEY);
};
