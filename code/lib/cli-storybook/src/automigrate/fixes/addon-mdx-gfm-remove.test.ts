import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import type { CheckOptions, RunOptions } from '../types';
import { addonMdxGfmRemove } from './addon-mdx-gfm-remove';

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
  const updateMainConfig = vi.fn().mockImplementation(({ mainConfigPath }, callback) => {
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
  removeDependencies: vi.fn(),
  runPackageCommand: vi.fn(),
} as unknown as JsPackageManager;

const baseCheckOptions: CheckOptions = {
  packageManager: mockPackageManager,
  mainConfig: {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
    addons: ['@storybook/addon-links'],
  } as StorybookConfigRaw,
  storybookVersion: '7.0.0',
  configDir: '.storybook',
};

interface AddonMdxGfmOptions {
  hasMdxGfm: boolean;
}

// Add type for migration object
interface Migration {
  check: (options: CheckOptions) => Promise<AddonMdxGfmOptions | null>;
  run: (options: RunOptions<any>) => Promise<void>;
}

const typedAddonMdxGfmRemove = addonMdxGfmRemove as Migration;

describe('addon-mdx-gfm-remove migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigs.clear();
  });

  describe('check phase', () => {
    it('returns null if no mainConfigPath provided', async () => {
      const result = await typedAddonMdxGfmRemove.check(baseCheckOptions);
      expect(result).toBeNull();
    });

    it('returns null if mdx-gfm not found in config', async () => {
      const mainConfig = `
        export default {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: ['@storybook/addon-links'],
        };
      `;
      readFileMock.mockResolvedValueOnce(mainConfig);

      const result = await typedAddonMdxGfmRemove.check({
        ...baseCheckOptions,
        mainConfigPath: 'main.ts',
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: ['@storybook/addon-links'],
        } as StorybookConfigRaw,
      });
      expect(result).toBeNull();
    });

    it('detects mdx-gfm addon when present as string', async () => {
      const mockMain: MockConfigFile = {
        getFieldValue: vi.fn().mockReturnValue(['@storybook/addon-mdx-gfm']),
        setFieldValue: vi.fn(),
        appendValueToArray: vi.fn(),
        removeField: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);

      const result = await typedAddonMdxGfmRemove.check({
        ...baseCheckOptions,
        mainConfigPath: 'main.ts',
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: ['@storybook/addon-mdx-gfm'],
        } as StorybookConfigRaw,
      });
      expect(result).toEqual({
        hasMdxGfm: true,
      });
    });

    it('detects mdx-gfm addon when present as object', async () => {
      const mockMain: MockConfigFile = {
        getFieldValue: vi.fn().mockReturnValue([{ name: '@storybook/addon-mdx-gfm' }]),
        setFieldValue: vi.fn(),
        appendValueToArray: vi.fn(),
        removeField: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);

      const result = await typedAddonMdxGfmRemove.check({
        ...baseCheckOptions,
        mainConfigPath: 'main.ts',
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: [{ name: '@storybook/addon-mdx-gfm' }],
        } as StorybookConfigRaw,
      });
      expect(result).toEqual({
        hasMdxGfm: true,
      });
    });
  });

  describe('run phase', () => {
    it('removes mdx-gfm addon using storybook remove command', async () => {
      await typedAddonMdxGfmRemove.run({
        result: {
          hasMdxGfm: true,
        },
        packageManager: mockPackageManager,
        configDir: '.storybook',
      } as RunOptions<AddonMdxGfmOptions>);

      expect(mockPackageManager.runPackageCommand).toHaveBeenCalledWith('storybook', [
        'remove',
        '@storybook/addon-mdx-gfm',
        '--config-dir',
        '.storybook',
      ]);
    });
  });
});
