import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getStorybookVersionSpecifier } from 'storybook/internal/cli';
import type { JsPackageManager, PackageJson } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import type { CheckOptions, RunOptions } from '../types';
import { addonEssentialsRemoveDocs } from './addon-essentials-remove-docs';

// Mock modules before any other imports or declarations
vi.mock('node:fs/promises', async () => {
  return {
    readFile: vi.fn(),
    lstat: vi.fn(),
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
  addDependencies: vi.fn(),
} as unknown as JsPackageManager;

const mockPackageJson = {
  dependencies: {},
  devDependencies: {},
} as PackageJson;

const baseCheckOptions: CheckOptions = {
  packageManager: mockPackageManager,
  mainConfig: {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  } as StorybookConfigRaw,
  storybookVersion: '7.0.0',
  configDir: '.storybook',
};

interface AddonDocsOptions {
  hasEssentials: boolean;
  hasDocsDisabled: boolean;
}

// Add type for migration object
interface Migration {
  check: (options: CheckOptions) => Promise<any>;
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
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);

      const result = await typedAddonDocsEssentials.check({
        ...baseCheckOptions,
        mainConfigPath: 'main.ts',
      });
      expect(result).toEqual({
        hasEssentials: true,
        hasDocsDisabled: true,
      });
    });

    it('detects essentials with docs enabled', async () => {
      const mockMain: MockConfigFile = {
        getFieldValue: vi.fn().mockReturnValue(['@storybook/addon-essentials']),
        setFieldValue: vi.fn(),
        appendValueToArray: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);

      const result = await typedAddonDocsEssentials.check({
        ...baseCheckOptions,
        mainConfigPath: 'main.ts',
      });
      expect(result).toEqual({
        hasEssentials: true,
        hasDocsDisabled: false,
      });
    });
  });

  describe('run phase', () => {
    it('removes docs config when docs is disabled', async () => {
      const mockMain: MockConfigFile = {
        getFieldValue: vi.fn().mockReturnValue([
          {
            name: '@storybook/addon-essentials',
            options: { docs: false, actions: true },
          },
        ]),
        setFieldValue: vi.fn(),
        appendValueToArray: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);

      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: true,
          hasDocsDisabled: true,
        },
        dryRun: false,
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
        } as StorybookConfigRaw,
      });

      expect(mockMain.setFieldValue).toHaveBeenCalledWith(
        ['addons'],
        [
          {
            name: '@storybook/addon-essentials',
            options: { actions: true },
          },
        ]
      );
    });

    it('installs and adds addon-docs when docs is enabled', async () => {
      const mockMain: MockConfigFile = {
        getFieldValue: vi.fn().mockReturnValue(['@storybook/addon-essentials']),
        setFieldValue: vi.fn(),
        appendValueToArray: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);

      vi.mocked(getStorybookVersionSpecifier).mockReturnValue('^7.0.0');
      vi.mocked(mockPackageManager.retrievePackageJson).mockResolvedValue({
        dependencies: {},
        devDependencies: {},
      });

      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: true,
          hasDocsDisabled: false,
        },
        dryRun: false,
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
        } as StorybookConfigRaw,
      });

      expect(mockPackageManager.addDependencies).toHaveBeenCalledWith(
        { installAsDevDependencies: true, skipInstall: false },
        ['@storybook/addon-docs@^7.0.0']
      );

      expect(mockMain.appendValueToArray).toHaveBeenCalledWith(['addons'], '@storybook/addon-docs');
    });

    it('does nothing in dry run mode', async () => {
      const mockMain: MockConfigFile = {
        getFieldValue: vi.fn().mockReturnValue(['@storybook/addon-essentials']),
        setFieldValue: vi.fn(),
        appendValueToArray: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);

      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: true,
          hasDocsDisabled: false,
        },
        dryRun: true,
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
        } as StorybookConfigRaw,
      });

      expect(mockPackageManager.addDependencies).not.toHaveBeenCalled();
    });
  });
});
