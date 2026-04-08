import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { rnOndeviceAddonsToDeviceAddons } from './rn-ondevice-addons-to-device-addons.ts';

// vi.hoisted ensures these are available when vi.mock factories run (before module imports)
const mocks = vi.hoisted(() => {
  const configFile = {
    removeEntryFromArray: vi.fn(),
    appendValueToArray: vi.fn(),
  };
  const updateMainConfig = vi.fn();
  return { configFile, updateMainConfig };
});

// Mock the updateMainConfig helper so we can assert on the AST manipulations.
vi.mock('../helpers/mainConfigFile', () => ({
  updateMainConfig: mocks.updateMainConfig,
}));

/** Creates a minimal package manager mock with the given dependencies. */
const makePackageManager = (allDeps: Record<string, string>) =>
  ({
    getAllDependencies: () => allDeps,
  }) as unknown as JsPackageManager;

describe('rn-ondevice-addons-to-device-addons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      const packageManager = makePackageManager({ '@storybook/react-native': '^8.0.0' });
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
      const packageManager = makePackageManager({ '@storybook/react-native': '^8.0.0' });
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
      const packageManager = makePackageManager({ '@storybook/react-native': '^8.0.0' });
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
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toEqual({
        ondeviceAddons: ['@storybook/addon-ondevice-controls', '@storybook/addon-ondevice-actions'],
      });
    });

    it('returns the ondevice addons when object addons with "ondevice" are present', async () => {
      const packageManager = makePackageManager({ '@storybook/react-native': '^8.0.0' });
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: [
          { name: '@storybook/addon-ondevice-controls', options: { expanded: true } },
          '@storybook/addon-docs',
        ],
      };

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig,
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toEqual({
        ondeviceAddons: [
          { name: '@storybook/addon-ondevice-controls', options: { expanded: true } },
        ],
      });
    });

    it('handles the case where @storybook/react-native is in dependencies (not devDependencies)', async () => {
      const packageManager = makePackageManager({ '@storybook/react-native': '^8.0.0' });
      const mainConfig: StorybookConfigRaw = {
        stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-ondevice-controls'],
      };

      const result = await rnOndeviceAddonsToDeviceAddons.check({
        packageManager,
        mainConfig,
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });

      expect(result).toEqual({
        ondeviceAddons: ['@storybook/addon-ondevice-controls'],
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
        result: { ondeviceAddons },
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
        { name: '@storybook/addon-ondevice-controls', options: { expanded: true } },
      ];

      await rnOndeviceAddonsToDeviceAddons.run?.({
        result: { ondeviceAddons },
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
        result: { ondeviceAddons },
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
  });
});
