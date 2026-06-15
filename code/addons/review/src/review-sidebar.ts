import type { API } from 'storybook/manager-api';

import { RESTORE_NAV_SESSION_KEY } from './constants.ts';
import { sessionStore } from './session-store.ts';

/** Show the manager sidebar when leaving the review summary. */
export const openReviewSidebar = (api: Pick<API, 'toggleNav'>) => {
  api.toggleNav(true);
  sessionStore.remove(RESTORE_NAV_SESSION_KEY);
};
