import { describe, expect, it, vi } from 'vitest';

import { init as initSettings } from '../modules/settings.ts';

const setup = (path: string) => {
  const navigate = vi.fn();
  const module = initSettings({ path, navigate, store: {}, fullAPI: {} } as any);
  module.init?.();
  return navigate;
};

describe('settings module init', () => {
  it('opens /settings/ when the URL path is /settings', () => {
    expect(setup('/settings')).toHaveBeenCalledWith('/settings/', { replace: true });
  });

  it.each(['/settings/', '/settings/about', '/story/button--primary', '/'])(
    'does not navigate for %s',
    (path) => {
      expect(setup(path)).not.toHaveBeenCalled();
    }
  );
});
