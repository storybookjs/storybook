import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import * as storybookCommon from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { rnOndeviceAddonsToDeviceAddons } from './rn-ondevice-addons-to-device-addons.ts';

// vi.hoisted ensures these are available when vi.mock factories run (before module imports)
const mocks = vi.hoisted(() => {
  const configFile = {
    removeEntryFromArray: vi.fn(),
    appendValueToArray: vi.fn(),
  };
  const updateMainConfig = vi.fn();
  return {
    configFile,
    updateMainConfig,
    /** When set, `existsSync` in the automigrate fix uses this instead of the real fs (ESM-safe). */
    existsSyncOverride: null as null | ((p: string) => boolean),
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: (p: Parameters<typeof actual.existsSync>[0]) =>
      mocks.existsSyncOverride != null ? mocks.existsSyncOverride(String(p)) : actual.existsSync(p),
  };
});

// Mock the updateMainConfig helper so we can assert on the AST manipulations.
vi.mock('../helpers/mainConfigFile', () => ({
  updateMainConfig: mocks.updateMainConfig,
}));

vi.mock('storybook/internal/common', async (importOriginal) => {
  const mod = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...mod,
    findConfigFile: vi.fn(mod.findConfigFile),
    loadMainConfig: vi.fn(mod.loadMainConfig),
  };
});

/** Creates a minimal package manager mock with the given dependencies. */
const makePackageManager = (allDeps: Record<string, string>) =>
  ({
    getAllDependencies: () => allDeps,
  }) as unknown as JsPackageManager;

describe('rn-ondevice-addons-to-device-addons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.existsSyncOverride = null;
    vi.mocked(storybookCommon.findConfigFile).mockImplementation(storybookCommon.findConfigFile);
    vi.mocked(storybookCommon.loadMainConfig).mockImplementation(storybookCommon.loadMainConfig);
    // Restore the implementation that invokes the callback with our mock ConfigFile
    mocks.updateMainConfig.mockImplementation(
      async (
        _opts: { mainConfigPath: string; dryRun: boolean },
        callback: (cfg: unknown) => Promise<void>
      ) => {
        await callback(mocks.configFile);
      }
    );
  });

  describe('check', () => {
    it('returns null when @storybook/react-native is not installed', async () => {
      const packageManager = makePackageManager({});
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-ondevice-controls', '@storybook/addon-ondevice-actions'],
      };

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig,
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toBeNull();
    });

    it('returns null when there are no ondevice addons in `addons`', async () => {
      const packageManager = makePackageManager({
        '@storybook/react-native': '^8.0.0',
      });
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-docs', '@storybook/addon-links'],
      };

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig,
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toBeNull();
    });

    it('returns null when there are no addons at all', async () => {
      const packageManager = makePackageManager({
        '@storybook/react-native': '^8.0.0',
      });
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
      };

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig,
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toBeNull();
    });

    it('returns the ondevice addons when string addons with "ondevice" are present', async () => {
      const packageManager = makePackageManager({
        '@storybook/react-native': '^8.0.0',
      });
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: [
          '@storybook/addon-ondevice-controls',
          '@storybook/addon-ondevice-actions',
          '@storybook/addon-docs',
        ],
      };

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig,
        mainConfigPath: '.storybook/main.ts',
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toEqual({
        targets: [
          {
            mainConfigPath: '.storybook/main.ts',
            ondeviceAddons: [
              '@storybook/addon-ondevice-controls',
              '@storybook/addon-ondevice-actions',
            ],
          },
        ],
      });
    });

    it('returns the ondevice addons when object addons with "ondevice" are present', async () => {
      const packageManager = makePackageManager({
        '@storybook/react-native': '^8.0.0',
      });
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: [
          {
            name: '@storybook/addon-ondevice-controls',
            options: { expanded: true },
          },
          '@storybook/addon-docs',
        ],
      };

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig,
        mainConfigPath: '.storybook/main.ts',
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toEqual({
        targets: [
          {
            mainConfigPath: '.storybook/main.ts',
            ondeviceAddons: [
              {
                name: '@storybook/addon-ondevice-controls',
                options: { expanded: true },
              },
            ],
          },
        ],
      });
    });

    it('handles the case where @storybook/react-native is in dependencies (not devDependencies)', async () => {
      const packageManager = makePackageManager({
        '@storybook/react-native': '^8.0.0',
      });
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-ondevice-controls'],
      };

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig,
        mainConfigPath: '.storybook/main.ts',
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toEqual({
        targets: [
          {
            mainConfigPath: '.storybook/main.ts',
            ondeviceAddons: ['@storybook/addon-ondevice-controls'],
          },
        ],
      });
    });

    it('includes both `.storybook/main` and `.rnstorybook/main` in targets when the pair exists and ondevice addons are only in RN main', async () => {
      mocks.existsSyncOverride = (p) => p.includes('.rnstorybook');

      const storybookMainPath = join(process.cwd(), '.storybook', 'main.ts');
      const rnMainPath = join(process.cwd(), '.rnstorybook', 'main.ts');
      vi.mocked(storybookCommon.findConfigFile).mockImplementation((prefix, dir) => {
        if (prefix === 'main' && String(dir).endsWith('.storybook')) {
          return storybookMainPath;
        }
        if (prefix === 'main' && String(dir).includes('.rnstorybook')) {
          return rnMainPath;
        }
        return storybookCommon.findConfigFile(prefix, dir);
      });

      vi.mocked(storybookCommon.loadMainConfig).mockResolvedValue({
        stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-ondevice-controls'],
      });

      const packageManager = makePackageManager({
        '@storybook/react-native': '^8.0.0',
      });
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-docs'],
      };

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig,
        mainConfigPath: storybookMainPath,
        configDir: '.storybook',
        storybookVersion: '9.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toEqual({
        targets: [
          {
            mainConfigPath: storybookMainPath,
            ondeviceAddons: [],
          },
          {
            mainConfigPath: rnMainPath,
            ondeviceAddons: ['@storybook/addon-ondevice-controls'],
          },
        ],
      });
      expect(storybookCommon.loadMainConfig).toHaveBeenCalledWith({
        configDir: join(process.cwd(), '.rnstorybook'),
      });
    });
  });

  describe('run', () => {
    it('removes ondevice addons from `addons` and adds them to `deviceAddons`', async () => {
      const ondeviceAddons = [
        '@storybook/addon-ondevice-controls',
        '@storybook/addon-ondevice-actions',
      ];

      await rnOndeviceAddonsToDeviceAddons.run?.({
        result: {
          targets: [{ mainConfigPath: '.rnstorybook/main.ts', ondeviceAddons }],
        },
        dryRun: false,
        mainConfigPath: '.rnstorybook/main.ts',
        mainConfig: {} as StorybookConfigRaw,
        packageManager: {} as any,
        configDir: '.rnstorybook',
        storybookVersion: '8.0.0',
        storiesPaths: [],
      });

      expect(mocks.configFile.removeEntryFromArray).toHaveBeenCalledTimes(2);
      expect(mocks.configFile.removeEntryFromArray).toHaveBeenCalledWith(
        ['addons'],
        '@storybook/addon-ondevice-controls'
      );
      expect(mocks.configFile.removeEntryFromArray).toHaveBeenCalledWith(
        ['addons'],
        '@storybook/addon-ondevice-actions'
      );

      expect(mocks.configFile.appendValueToArray).toHaveBeenCalledTimes(2);
      expect(mocks.configFile.appendValueToArray).toHaveBeenCalledWith(
        ['deviceAddons'],
        '@storybook/addon-ondevice-controls'
      );
      expect(mocks.configFile.appendValueToArray).toHaveBeenCalledWith(
        ['deviceAddons'],
        '@storybook/addon-ondevice-actions'
      );
    });

    it('preserves object-form addons when moving to `deviceAddons`', async () => {
      const ondeviceAddons = [
        {
          name: '@storybook/addon-ondevice-controls',
          options: { expanded: true },
        },
      ];

      await rnOndeviceAddonsToDeviceAddons.run?.({
        result: {
          targets: [{ mainConfigPath: '.rnstorybook/main.ts', ondeviceAddons }],
        },
        dryRun: false,
        mainConfigPath: '.rnstorybook/main.ts',
        mainConfig: {} as StorybookConfigRaw,
        packageManager: {} as any,
        configDir: '.rnstorybook',
        storybookVersion: '8.0.0',
        storiesPaths: [],
      });

      expect(mocks.configFile.removeEntryFromArray).toHaveBeenCalledWith(
        ['addons'],
        '@storybook/addon-ondevice-controls'
      );
      expect(mocks.configFile.appendValueToArray).toHaveBeenCalledWith(['deviceAddons'], {
        name: '@storybook/addon-ondevice-controls',
        options: { expanded: true },
      });
    });

    it('passes dryRun flag to updateMainConfig', async () => {
      const ondeviceAddons = ['@storybook/addon-ondevice-controls'];

      await rnOndeviceAddonsToDeviceAddons.run?.({
        result: {
          targets: [{ mainConfigPath: '.rnstorybook/main.ts', ondeviceAddons }],
        },
        dryRun: true,
        mainConfigPath: '.rnstorybook/main.ts',
        mainConfig: {} as StorybookConfigRaw,
        packageManager: {} as any,
        configDir: '.rnstorybook',
        storybookVersion: '8.0.0',
        storiesPaths: [],
      });

      // updateMainConfig is always called; it handles dryRun internally by not writing the file
      expect(mocks.updateMainConfig).toHaveBeenCalledWith(
        { mainConfigPath: '.rnstorybook/main.ts', dryRun: true },
        expect.any(Function)
      );
    });

    it('runs updateMainConfig once per target when multiple mains need changes', async () => {
      await rnOndeviceAddonsToDeviceAddons.run?.({
        result: {
          targets: [
            {
              mainConfigPath: '.storybook/main.ts',
              ondeviceAddons: ['@storybook/addon-ondevice-actions'],
            },
            {
              mainConfigPath: '.rnstorybook/main.ts',
              ondeviceAddons: ['@storybook/addon-ondevice-controls'],
            },
          ],
        },
        dryRun: false,
        mainConfigPath: '.storybook/main.ts',
        mainConfig: {} as StorybookConfigRaw,
        packageManager: {} as any,
        configDir: '.storybook',
        storybookVersion: '8.0.0',
        storiesPaths: [],
      });

      expect(mocks.updateMainConfig).toHaveBeenCalledTimes(2);
      expect(mocks.updateMainConfig).toHaveBeenNthCalledWith(
        1,
        { mainConfigPath: '.storybook/main.ts', dryRun: false },
        expect.any(Function)
      );
      expect(mocks.updateMainConfig).toHaveBeenNthCalledWith(
        2,
        { mainConfigPath: '.rnstorybook/main.ts', dryRun: false },
        expect.any(Function)
      );
    });

    it('calls updateMainConfig for every target in a web+RN pair (including when one has no ondevice addons)', async () => {
      await rnOndeviceAddonsToDeviceAddons.run?.({
        result: {
          targets: [
            { mainConfigPath: '.storybook/main.ts', ondeviceAddons: [] },
            {
              mainConfigPath: '.rnstorybook/main.ts',
              ondeviceAddons: ['@storybook/addon-ondevice-controls'],
            },
          ],
        },
        dryRun: false,
        mainConfigPath: '.storybook/main.ts',
        mainConfig: {} as StorybookConfigRaw,
        packageManager: {} as any,
        configDir: '.storybook',
        storybookVersion: '8.0.0',
        storiesPaths: [],
      });

      expect(mocks.updateMainConfig).toHaveBeenCalledTimes(2);
      expect(mocks.updateMainConfig).toHaveBeenNthCalledWith(
        1,
        { mainConfigPath: '.storybook/main.ts', dryRun: false },
        expect.any(Function)
      );
      expect(mocks.updateMainConfig).toHaveBeenNthCalledWith(
        2,
        { mainConfigPath: '.rnstorybook/main.ts', dryRun: false },
        expect.any(Function)
      );
    });
  });
});
