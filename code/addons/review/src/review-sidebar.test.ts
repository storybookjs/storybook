import { describe, expect, it, vi } from 'vitest';

import { RESTORE_NAV_SESSION_KEY, RESTORE_PANEL_SESSION_KEY } from './constants.ts';
import { openReviewSidebar } from './review-sidebar.ts';
import { sessionStore } from './session-store.ts';

describe('openReviewSidebar', () => {
  it('always expands the sidebar and addon panel and clears the restore flags', () => {
    sessionStore.write(RESTORE_NAV_SESSION_KEY, 'keep');
    sessionStore.write(RESTORE_PANEL_SESSION_KEY, 'keep');
    const toggleNav = vi.fn();
    const togglePanel = vi.fn();

    openReviewSidebar({ toggleNav, togglePanel });

    expect(toggleNav).toHaveBeenCalledWith(true);
    expect(togglePanel).toHaveBeenCalledWith(true);
    expect(sessionStore.read(RESTORE_NAV_SESSION_KEY)).toBeNull();
    expect(sessionStore.read(RESTORE_PANEL_SESSION_KEY)).toBeNull();
  });
});
