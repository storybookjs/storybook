import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAddonNames } from 'storybook/internal/common';

import { removeAddonInteractions } from './remove-addon-interactions';

vi.mock('storybook/internal/common', async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    getAddonNames: vi.fn(),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('check', () => {
    it('should return null if addon-interactions is not present', async () => {
      vi.mocked(getAddonNames).mockReturnValue(['@storybook/addon-essentials']);
      const result = await removeAddonInteractions.check({ mainConfig: {} } as any);
      expect(result).toBeNull();
    });

    it('should return empty object if addon-interactions is present', async () => {
      vi.mocked(getAddonNames).mockReturnValue(['@storybook/addon-interactions']);
      const result = await removeAddonInteractions.check({ mainConfig: {} } as any);
      expect(result).toEqual({});
    });
  });

  describe('prompt', () => {
    it('should return the correct message', () => {
      const message = removeAddonInteractions.prompt({});
      expect(message).toContain(
        '@storybook/addon-interactions has been consolidated into Storybook core'
      );
    });
  });

  describe('run', () => {
    it('should run storybook remove command', async () => {
      const mockPackageManager = {
        runPackageCommand: vi.fn(),
      };

      await removeAddonInteractions?.run?.({
        packageManager: mockPackageManager,
        configDir: './storybook',
      } as any);

      expect(mockPackageManager.runPackageCommand).toHaveBeenCalledWith('storybook', [
        'remove',
        '@storybook/addon-interactions',
        '--config-dir',
        './storybook',
      ]);
    });
  });
});
