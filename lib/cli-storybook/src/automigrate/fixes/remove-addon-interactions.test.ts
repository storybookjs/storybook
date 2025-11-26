import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAddonNames } from 'storybook/internal/common';

import { removeAddonInteractions } from './remove-addon-interactions';

vi.mock('storybook/internal/common', async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    getAddonNames: vi.fn(),
    removeAddon: vi.fn(),
  };
});

vi.mock('picocolors', async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    default: {
      magenta: (s: string) => s,
    },
  };
});

describe('removeAddonInteractions', () => {
  const mockPackageManager = {
    isDependencyInstalled: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockPackageManager.isDependencyInstalled).mockReturnValue(false);
  });

  describe('check', () => {
    it('should return null if addon-interactions is not present', async () => {
      vi.mocked(getAddonNames).mockReturnValue(['@storybook/addon-essentials']);
      const result = await removeAddonInteractions.check({
        mainConfig: {},
        packageManager: mockPackageManager,
      } as any);
      expect(result).toBeNull();
    });

    it('should return true if addon-interactions is present', async () => {
      vi.mocked(getAddonNames).mockReturnValue(['@storybook/addon-interactions']);
      const result = await removeAddonInteractions.check({
        mainConfig: {},
        packageManager: mockPackageManager,
      } as any);
      expect(result).toEqual(true);
    });
  });

  describe('run', () => {
    it('should run storybook remove command', async () => {
      const { removeAddon } = await import('storybook/internal/common');

      await removeAddonInteractions?.run?.({
        packageManager: {} as any,
        configDir: './storybook',
        dryRun: false,
      } as any);

      expect(removeAddon).toHaveBeenCalledWith('@storybook/addon-interactions', {
        configDir: './storybook',
        skipInstall: true,
        packageManager: {},
      });
    });
  });
});
