import { describe, expect, it, vi } from 'vitest';

import { init as initSettings } from '../modules/settings.ts';

const setup = (path: string) => {
  const navigate = vi.fn();
  const module = initSettings({ path, navigate, store: {}, fullAPI: {} } as any);
  module.init?.();
  return { navigate, api: module.api };
};

describe('settings module init', () => {
  it('opens /settings/ when the URL path is /settings', () => {
    expect(setup('/settings').navigate).toHaveBeenCalledWith('/settings/', { replace: true });
  });

  it.each(['/settings/', '/settings/about', '/story/button--primary', '/'])(
    'does not navigate for %s',
    (path) => {
      expect(setup(path).navigate).not.toHaveBeenCalled();
    }
  );
});

describe('changeSettingsTab', () => {
  it('adds a history entry by default', () => {
    const { navigate, api } = setup('/settings/about');
    api.changeSettingsTab('shortcuts');
    expect(navigate).toHaveBeenCalledWith('/settings/shortcuts', undefined);
  });

  it('replaces the history entry when asked to', () => {
    const { navigate, api } = setup('/settings/');
    api.changeSettingsTab('about', { replace: true });
    expect(navigate).toHaveBeenCalledWith('/settings/about', { replace: true });
  });
});
