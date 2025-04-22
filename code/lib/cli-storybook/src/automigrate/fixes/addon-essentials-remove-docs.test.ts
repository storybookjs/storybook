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

vi.mock('storybook/internal/common', () => ({
  getAddonNames: vi.fn(),
  getProjectRoot: vi.fn().mockReturnValue('/fake/project/root'),
  commonGlobOptions: vi.fn().mockReturnValue({}),
}));

vi.mock('prompts', () => ({
  default: vi.fn().mockResolvedValue({ glob: '**/*.{mjs,cjs,js,jsx,ts,tsx,mdx}' }),
}));

vi.mock('globby', () => ({
  globby: vi.fn().mockResolvedValue(['/fake/project/root/src/stories/Button.stories.tsx']),
}));

vi.mock('../helpers/transformImports', () => ({
  transformImportFiles: vi.fn().mockResolvedValue([]),
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
  retrievePackageJson: vi.fn().mockResolvedValue({
    dependencies: {},
    devDependencies: {},
  }),
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
  additionalAddonsToRemove: string[];
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

    it('returns null if essentials and no core addons found in config', async () => {
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

    it('detects essentials with docs disabled and core addons', async () => {
      const mockMain: MockConfigFile = {
        getFieldValue: vi.fn().mockReturnValue([
          {
            name: '@storybook/addon-essentials',
            options: { docs: false },
          },
          '@storybook/addon-actions',
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
      vi.mocked(await import('storybook/internal/common')).getAddonNames.mockReturnValue([
        '@storybook/addon-essentials',
        '@storybook/addon-actions',
      ]);

      const mockPackageJsonWithAddons = {
        dependencies: {
          '@storybook/addon-controls': '^7.0.0',
        },
        devDependencies: {
          '@storybook/addon-toolbars': '^7.0.0',
        },
      };

      vi.mocked(mockPackageManager.retrievePackageJson).mockResolvedValueOnce(
        mockPackageJsonWithAddons
      );

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
            '@storybook/addon-actions',
          ],
        } as StorybookConfigRaw,
      });
      expect(result).toEqual({
        hasEssentials: true,
        hasDocsDisabled: true,
        hasDocsAddon: false,
        additionalAddonsToRemove: [
          '@storybook/addon-actions',
          '@storybook/addon-controls',
          '@storybook/addon-toolbars',
        ],
      });
    });

    it('detects only core addons without essentials', async () => {
      const mockMain: MockConfigFile = {
        getFieldValue: vi.fn().mockReturnValue(['@storybook/addon-actions']),
        setFieldValue: vi.fn(),
        appendValueToArray: vi.fn(),
        removeField: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);
      vi.mocked(await import('storybook/internal/common')).getAddonNames.mockReturnValue([
        '@storybook/addon-actions',
      ]);

      const mockPackageJsonWithViewport = {
        dependencies: {},
        devDependencies: {
          '@storybook/addon-viewport': '^7.0.0',
        },
      };

      vi.mocked(mockPackageManager.retrievePackageJson).mockResolvedValueOnce(
        mockPackageJsonWithViewport
      );

      const result = await typedAddonDocsEssentials.check({
        ...baseCheckOptions,
        mainConfigPath: 'main.ts',
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          addons: ['@storybook/addon-actions'],
        } as StorybookConfigRaw,
      });
      expect(result).toEqual({
        hasEssentials: false,
        hasDocsDisabled: false,
        hasDocsAddon: false,
        additionalAddonsToRemove: ['@storybook/addon-actions', '@storybook/addon-viewport'],
      });
    });
  });

  describe('run phase', () => {
    it('removes essentials addon and core addons when docs is disabled', async () => {
      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: true,
          hasDocsDisabled: true,
          hasDocsAddon: false,
          additionalAddonsToRemove: ['@storybook/addon-actions', '@storybook/addon-controls'],
        },
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        mainConfig: {} as StorybookConfigRaw,
        storybookVersion: '8.0.0',
      });

      expect(mockPackageManager.runPackageCommand).toHaveBeenCalledWith('storybook', [
        'remove',
        '@storybook/addon-essentials',
      ]);
      expect(mockPackageManager.runPackageCommand).toHaveBeenCalledWith('storybook', [
        'remove',
        '@storybook/addon-actions',
      ]);
      expect(mockPackageManager.runPackageCommand).toHaveBeenCalledWith('storybook', [
        'remove',
        '@storybook/addon-controls',
      ]);
      expect(mockPackageManager.runPackageCommand).toHaveBeenCalledTimes(3);
    });

    it('removes core addons without essentials', async () => {
      const mockPackageManagerLocal = {
        retrievePackageJson: vi.fn(),
        runPackageCommand: vi.fn(),
      } as unknown as JsPackageManager;

      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: false,
          hasDocsDisabled: false,
          hasDocsAddon: false,
          additionalAddonsToRemove: ['@storybook/addon-actions', '@storybook/addon-controls'],
        },
        packageManager: mockPackageManagerLocal,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        mainConfig: {} as StorybookConfigRaw,
        storybookVersion: '8.0.0',
      });

      expect(mockPackageManagerLocal.runPackageCommand).toHaveBeenCalledWith('storybook', [
        'remove',
        '@storybook/addon-actions',
      ]);
      expect(mockPackageManagerLocal.runPackageCommand).toHaveBeenCalledWith('storybook', [
        'remove',
        '@storybook/addon-controls',
      ]);
      expect(mockPackageManagerLocal.runPackageCommand).toHaveBeenCalledWith('storybook', [
        'add',
        '@storybook/addon-docs',
      ]);
      expect(mockPackageManagerLocal.runPackageCommand).toHaveBeenCalledTimes(3);
    });

    it('handles import transformations', async () => {
      const { transformImportFiles } = await import('../helpers/transformImports');

      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: false,
          hasDocsDisabled: false,
          hasDocsAddon: false,
          additionalAddonsToRemove: ['@storybook/addon-actions', '@storybook/addon-controls'],
        },
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        mainConfig: {} as StorybookConfigRaw,
        storybookVersion: '8.0.0',
      });

      expect(transformImportFiles).toHaveBeenCalledWith(
        ['/fake/project/root/src/stories/Button.stories.tsx'],
        {
          '@storybook/addon-actions': 'storybook/actions',
          '@storybook/addon-controls': 'storybook/internal/controls',
          '@storybook/addon-toolbars': 'storybook/internal/toolbars',
          '@storybook/addon-highlight': 'storybook/highlight',
          '@storybook/addon-measure': 'storybook/measure',
          '@storybook/addon-outline': 'storybook/outline',
          '@storybook/addon-backgrounds': 'storybook/backgrounds',
          '@storybook/addon-viewport': 'storybook/viewport',
        },
        undefined
      );
    });

    it('does nothing in dry run mode', async () => {
      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: true,
          hasDocsDisabled: false,
          hasDocsAddon: false,
          additionalAddonsToRemove: ['@storybook/addon-actions', '@storybook/addon-controls'],
        },
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        mainConfig: {} as StorybookConfigRaw,
        dryRun: true,
        storybookVersion: '8.0.0',
      });

      expect(mockPackageManager.runPackageCommand).not.toHaveBeenCalled();
    });

    it('handles missing essentials addon and no core addons gracefully', async () => {
      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: false,
          hasDocsDisabled: false,
          hasDocsAddon: false,
          additionalAddonsToRemove: [],
        },
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        mainConfig: {} as StorybookConfigRaw,
        storybookVersion: '8.0.0',
      });

      expect(mockPackageManager.runPackageCommand).not.toHaveBeenCalled();
    });
  });
});
