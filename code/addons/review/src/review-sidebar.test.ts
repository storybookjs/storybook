import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RESTORE_NAV_SESSION_KEY, RESTORE_PANEL_SESSION_KEY } from './constants.ts';
import { collapseReviewChrome, openReviewSidebar } from './review-sidebar.ts';
import { sessionStore } from './session-store.ts';

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  vi.spyOn(sessionStore, 'read').mockImplementation((key) => memory.get(key) ?? null);
  vi.spyOn(sessionStore, 'write').mockImplementation((key, value) => {
    memory.set(key, value);
  });
  vi.spyOn(sessionStore, 'remove').mockImplementation((key) => {
    memory.delete(key);
  });
});

describe('collapseReviewChrome', () => {
  it('hides the sidebar and addon panel and records restore flags', () => {
    const toggleNav = vi.fn();
    const togglePanel = vi.fn();
    const api = {
      toggleNav,
      togglePanel,
      getIsNavShown: () => true,
      getIsPanelShown: () => true,
    };

    collapseReviewChrome(api);

    expect(toggleNav).toHaveBeenCalledWith(false);
    expect(togglePanel).toHaveBeenCalledWith(false);
    expect(sessionStore.read(RESTORE_NAV_SESSION_KEY)).toBe('restore');
    expect(sessionStore.read(RESTORE_PANEL_SESSION_KEY)).toBe('restore');
  });

  it('does not overwrite existing restore flags', () => {
    sessionStore.write(RESTORE_NAV_SESSION_KEY, 'keep');
    sessionStore.write(RESTORE_PANEL_SESSION_KEY, 'keep');
    const toggleNav = vi.fn();
    const togglePanel = vi.fn();

    collapseReviewChrome({
      toggleNav,
      togglePanel,
      getIsNavShown: () => true,
      getIsPanelShown: () => true,
    });

    expect(sessionStore.read(RESTORE_NAV_SESSION_KEY)).toBe('keep');
    expect(sessionStore.read(RESTORE_PANEL_SESSION_KEY)).toBe('keep');
  });

  it('no-ops when layout API methods are missing', () => {
    expect(() => collapseReviewChrome({})).not.toThrow();
    expect(sessionStore.read(RESTORE_NAV_SESSION_KEY)).toBe('restore');
    expect(sessionStore.read(RESTORE_PANEL_SESSION_KEY)).toBe('restore');
  });
});

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
