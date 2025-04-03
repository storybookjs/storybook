import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager, PackageJson } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import type { CheckOptions, RunOptions } from '../types';
import { addonEssentialsRemoveDocs } from './addon-essentials-remove-docs';

// Mock modules before any other imports or declarations
vi.mock('node:fs/promises', async () => {
  return {
    readFile: vi.fn(),
    lstat: vi.fn(),
    readdir: vi.fn(),
    readlink: vi.fn(),
    realpath: vi.fn(),
  };
});

vi.mock('../helpers/mainConfigFile', () => {
  const updateMainConfig = vi.fn().mockImplementation(({ mainConfigPath, dryRun }, callback) => {
    return callback(mockConfigs.get(mainConfigPath));
  });
  return { updateMainConfig };
});

vi.mock('storybook/internal/cli', () => ({
  getStorybookVersionSpecifier: vi.fn(),
}));

// Mock ConfigFile type
interface MockConfigFile {
  getFieldValue: (path: string[]) => any;
  setFieldValue: (path: string[], value: any) => void;
  appendValueToArray: (path: string[], value: any) => void;
  removeField: (path: string[]) => void;
  _ast: Record<string, unknown>;
  _code: string;
  _exports: Record<string, unknown>;
  _exportDecls: unknown[];
}

// Store mock configs by path
const mockConfigs = new Map<string, MockConfigFile>();

// Get reference to mocked readFile
const readFileMock = vi.mocked(await import('node:fs/promises')).readFile;

const mockPackageManager = {
  retrievePackageJson: vi.fn(),
  runPackageCommand: vi.fn(),
} as unknown as JsPackageManager;

const mockPackageJson = {
  dependencies: {},
  devDependencies: {},
} as PackageJson;

const baseCheckOptions: CheckOptions = {
  packageManager: mockPackageManager,
  mainConfig: {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
    addons: ['@storybook/addon-links'],
  } as StorybookConfigRaw,
  storybookVersion: '7.0.0',
  configDir: '.storybook',
};

interface AddonDocsOptions {
  hasEssentials: boolean;
  hasDocsDisabled: boolean;
  hasDocsAddon: boolean;
}

// Add type for migration object
interface Migration {
  check: (options: CheckOptions) => Promise<AddonDocsOptions | null>;
  run: (options: RunOptions<any>) => Promise<void>;
}

const typedAddonDocsEssentials = addonEssentialsRemoveDocs as Migration;

describe('addon-essentials-remove-docs migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigs.clear();
  });

  describe('check phase', () => {
    it('returns null if no mainConfigPath provided', async () => {
      const result = await typedAddonDocsEssentials.check(baseCheckOptions);
      expect(result).toBeNull();
    });

    it('returns null if essentials not found in config', async () => {
      const mainConfig = `
        export default {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: ['@storybook/addon-links'],
        };
      `;
      readFileMock.mockResolvedValueOnce(mainConfig);

      const result = await typedAddonDocsEssentials.check({
        ...baseCheckOptions,
        mainConfigPath: 'main.ts',
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: ['@storybook/addon-links'],
        } as StorybookConfigRaw,
      });
      expect(result).toBeNull();
    });

    it('detects essentials with docs disabled', async () => {
      const mockMain: MockConfigFile = {
        getFieldValue: vi.fn().mockReturnValue([
          {
            name: '@storybook/addon-essentials',
            options: { docs: false },
          },
        ]),
        setFieldValue: vi.fn(),
        appendValueToArray: vi.fn(),
        removeField: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);

      const result = await typedAddonDocsEssentials.check({
        ...baseCheckOptions,
        mainConfigPath: 'main.ts',
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: [
            {
              name: '@storybook/addon-essentials',
              options: { docs: false },
            },
          ],
        } as StorybookConfigRaw,
      });
      expect(result).toEqual({
        hasEssentials: true,
        hasDocsDisabled: true,
        hasDocsAddon: false,
      });
    });

    it('detects essentials with docs enabled', async () => {
      const mockMain: MockConfigFile = {
        getFieldValue: vi.fn().mockReturnValue(['@storybook/addon-essentials']),
        setFieldValue: vi.fn(),
        appendValueToArray: vi.fn(),
        removeField: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);

      const result = await typedAddonDocsEssentials.check({
        ...baseCheckOptions,
        mainConfigPath: 'main.ts',
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: ['@storybook/addon-essentials'],
        } as StorybookConfigRaw,
      });
      expect(result).toEqual({
        hasEssentials: true,
        hasDocsDisabled: false,
        hasDocsAddon: false,
      });
    });
  });

  describe('run phase', () => {
    it('removes essentials addon when docs is disabled', async () => {
      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: true,
          hasDocsDisabled: true,
          hasDocsAddon: false,
        },
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        mainConfig: {} as StorybookConfigRaw,
      });

      expect(mockPackageManager.runPackageCommand).toHaveBeenCalledWith('storybook', [
        'remove',
        '@storybook/addon-essentials',
      ]);
      expect(mockPackageManager.runPackageCommand).toHaveBeenCalledTimes(1);
    });

    it('removes essentials addon and installs addon-docs when docs is enabled', async () => {
      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: true,
          hasDocsDisabled: false,
          hasDocsAddon: false,
        },
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        mainConfig: {} as StorybookConfigRaw,
      });

      expect(mockPackageManager.runPackageCommand).toHaveBeenCalledWith('storybook', [
        'remove',
        '@storybook/addon-essentials',
      ]);
      expect(mockPackageManager.runPackageCommand).toHaveBeenCalledWith('storybook', [
        'add',
        '@storybook/addon-docs',
      ]);
      expect(mockPackageManager.runPackageCommand).toHaveBeenCalledTimes(2);
    });

    it('does nothing in dry run mode', async () => {
      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: true,
          hasDocsDisabled: false,
          hasDocsAddon: false,
        },
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        mainConfig: {} as StorybookConfigRaw,
        dryRun: true,
      });

      expect(mockPackageManager.runPackageCommand).not.toHaveBeenCalled();
    });

    it('handles missing essentials addon gracefully', async () => {
      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: false,
          hasDocsDisabled: false,
          hasDocsAddon: false,
        },
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        mainConfig: {} as StorybookConfigRaw,
      });

      expect(mockPackageManager.runPackageCommand).not.toHaveBeenCalled();
    });
  });
});
