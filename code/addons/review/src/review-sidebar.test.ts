import { describe, expect, it, vi } from 'vitest';

import { RESTORE_NAV_SESSION_KEY } from './constants.ts';
import { openReviewSidebar } from './review-sidebar.ts';
import { sessionStore } from './session-store.ts';

describe('openReviewSidebar', () => {
  it('always expands the sidebar and clears the restore flag', () => {
    sessionStore.write(RESTORE_NAV_SESSION_KEY, 'keep');
    const toggleNav = vi.fn();

    openReviewSidebar({ toggleNav });

    expect(toggleNav).toHaveBeenCalledWith(true);
    expect(sessionStore.read(RESTORE_NAV_SESSION_KEY)).toBeNull();
  });
});
