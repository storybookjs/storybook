import { describe, expect, it, vi } from 'vitest';

import type { ModuleArgs } from '../lib/types.tsx';
import { init as initSettings } from '../modules/settings.ts';

describe('settings API', () => {
  describe('changeSettingsTab', () => {
    it('navigates to the settings page', () => {
      const navigate = vi.fn();
      const { api } = initSettings({ navigate } as unknown as ModuleArgs);

      api.changeSettingsTab('about');

      expect(navigate).toHaveBeenCalledWith('/settings/about', undefined);
    });

    it('passes navigation options', () => {
      const navigate = vi.fn();
      const { api } = initSettings({ navigate } as unknown as ModuleArgs);

      api.changeSettingsTab('about', { replace: true });

      expect(navigate).toHaveBeenCalledWith('/settings/about', { replace: true });
    });
  });
});
