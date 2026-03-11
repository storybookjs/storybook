import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JsPackageManager, removeAddon } from 'storybook/internal/common';
import { formatConfig, readConfig } from 'storybook/internal/csf-tools';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { add } from '../../add';
import type { CheckOptions, RunOptions } from '../types';
import { removeEssentials } from './remove-essentials';
import { moveEssentialOptions } from './remove-essentials.utils';

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

vi.mock('storybook/internal/common', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('storybook/internal/common')>()),
    getAddonNames: vi.fn(),
    getProjectRoot: () => '/fake/project/root',
    commonGlobOptions: vi.fn().mockReturnValue({}),
    removeAddon: vi.fn().mockResolvedValue(undefined),
    transformImportFiles: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../../add', () => ({
  add: vi.fn(),
}));

vi.mock('globby', () => ({
  globby: vi.fn().mockResolvedValue(['/fake/project/root/src/stories/Button.stories.tsx']),
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

const mockPackageManager = vi.mocked(JsPackageManager.prototype);
const mockRemoveAddon = vi.mocked(removeAddon);
const mockTransformImportFiles = vi.mocked(
  await import('storybook/internal/common')
).transformImportFiles;

const mockedAdd = vi.mocked(add);

const baseCheckOptions: CheckOptions = {
  packageManager: mockPackageManager,
  mainConfig: {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
    addons: ['@storybook/addon-links'],
  } as StorybookConfigRaw,
  storybookVersion: '7.0.0',
  configDir: '.storybook',
  storiesPaths: [],
  hasCsfFactoryPreview: false,
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

const typedAddonDocsEssentials = removeEssentials as Migration;

describe('remove-essentials migration', () => {
  beforeEach(() => {
    // @ts-expect-error Ignore readonly property
    mockPackageManager.primaryPackageJson = {
      packageJson: { devDependencies: {}, dependencies: {} },
      packageJsonPath: 'some/path',
      operationDir: 'some/path',
    };
    mockPackageManager.packageJsonPaths = ['some/path'];
    mockPackageManager.runPackageCommand = vi.fn();
    mockPackageManager.getAllDependencies = vi.fn(() => ({}));
    mockPackageManager.addDependencies = vi.fn();
    mockPackageManager.getInstalledVersion = vi.fn().mockResolvedValue(null);
    mockPackageManager.isPackageInstalled = vi.fn().mockResolvedValue(false);

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

      // @ts-expect-error Ignore readonly property
      mockPackageManager.primaryPackageJson = {
        packageJson: mockPackageJsonWithAddons,
        packageJsonPath: 'some/path',
        operationDir: 'some/path',
      };

      mockPackageManager.getAllDependencies.mockReturnValue({
        ...mockPackageJsonWithAddons.dependencies,
        ...mockPackageJsonWithAddons.devDependencies,
      });

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
        allDeps: {
          '@storybook/addon-controls': '^7.0.0',
          '@storybook/addon-toolbars': '^7.0.0',
        },
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

      // @ts-expect-error Ignore readonly property
      mockPackageManager.primaryPackageJson = {
        packageJson: mockPackageJsonWithViewport,
        packageJsonPath: 'some/path',
        operationDir: 'some/path',
      };

      mockPackageManager.getAllDependencies.mockReturnValue({
        ...mockPackageJsonWithViewport.dependencies,
        ...mockPackageJsonWithViewport.devDependencies,
      });

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
        allDeps: {
          '@storybook/addon-viewport': '^7.0.0',
        },
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
        configDir: '.storybook',
        packageManager: mockPackageManager,
        storiesPaths: [],
        mainConfigPath: '.storybook/main.ts',
        storybookVersion: '8.0.0',
        mainConfig: {} as StorybookConfigRaw,
      });

      expect(mockRemoveAddon).toHaveBeenCalledWith(
        '@storybook/addon-essentials',
        expect.any(Object)
      );
      expect(mockRemoveAddon).toHaveBeenCalledWith('@storybook/addon-actions', expect.any(Object));
      expect(mockRemoveAddon).toHaveBeenCalledWith('@storybook/addon-controls', expect.any(Object));
      expect(mockRemoveAddon).toHaveBeenCalledTimes(3);
    });

    it('does not add docs addon if essentials is not present', async () => {
      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: false,
          hasDocsDisabled: false,
          hasDocsAddon: false,
          additionalAddonsToRemove: [],
        },
        packageManager: mockPackageManager,
        storiesPaths: [],
        mainConfigPath: '.storybook/main.ts',
        configDir: '.storybook',
        storybookVersion: '8.0.0',
        mainConfig: {} as StorybookConfigRaw,
      });

      expect(mockRemoveAddon).not.toHaveBeenCalledWith('@storybook/addon-docs', expect.any(Object));
    });

    it('removes core addons without essentials', async () => {
      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: false,
          hasDocsDisabled: false,
          hasDocsAddon: false,
          additionalAddonsToRemove: ['@storybook/addon-actions', '@storybook/addon-controls'],
        },
        packageManager: mockPackageManager,
        storiesPaths: [],
        mainConfigPath: '.storybook/main.ts',
        configDir: '.storybook',
        storybookVersion: '8.0.0',
        mainConfig: {} as StorybookConfigRaw,
      });

      expect(mockRemoveAddon).toHaveBeenCalledWith('@storybook/addon-actions', expect.any(Object));
      expect(mockRemoveAddon).toHaveBeenCalledWith('@storybook/addon-controls', expect.any(Object));
      expect(mockRemoveAddon).toHaveBeenCalledTimes(2);
    });

    it('does not add docs addon if essentials is not present', async () => {
      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: false,
          hasDocsDisabled: false,
          hasDocsAddon: false,
          additionalAddonsToRemove: [],
        },
        packageManager: mockPackageManager,
        storiesPaths: [],
        mainConfigPath: '.storybook/main.ts',
        configDir: '.storybook',
        storybookVersion: '8.0.0',
        mainConfig: {} as StorybookConfigRaw,
      });

      expect(mockPackageManager.runPackageCommand).not.toHaveBeenCalledWith('storybook', [
        'add',
        '@storybook/addon-docs',
        '--config-dir',
        '.storybook',
      ]);
    });

    it('does add docs addon if essentials is present', async () => {
      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: true,
          hasDocsDisabled: false,
          hasDocsAddon: false,
          additionalAddonsToRemove: [],
        },
        packageManager: mockPackageManager,
        storiesPaths: [],
        mainConfigPath: '.storybook/main.ts',
        configDir: '.storybook',
        storybookVersion: '8.0.0',
        mainConfig: {} as StorybookConfigRaw,
      });

      expect(mockedAdd).toHaveBeenCalledWith('@storybook/addon-docs', {
        configDir: '.storybook',
        packageManager: mockPackageManager.type,
        skipInstall: true,
        skipPostinstall: true,
        yes: true,
      });
    });

    it('handles import transformations', async () => {
      await typedAddonDocsEssentials.run({
        result: {
          hasEssentials: false,
          hasDocsDisabled: false,
          hasDocsAddon: false,
          additionalAddonsToRemove: ['@storybook/addon-actions', '@storybook/addon-controls'],
        },
        packageManager: mockPackageManager,
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '8.0.0',
        mainConfigPath: '.storybook/main.ts',
        mainConfig: {} as StorybookConfigRaw,
      });

      expect(mockTransformImportFiles).toHaveBeenCalledWith(
        ['.storybook/main.ts'],
        {
          '@storybook/addon-actions': 'storybook/actions',
          '@storybook/addon-backgrounds': 'storybook/backgrounds',
          '@storybook/addon-controls': 'storybook/internal/controls',
          '@storybook/addon-highlight': 'storybook/highlight',
          '@storybook/addon-measure': 'storybook/measure',
          '@storybook/addon-outline': 'storybook/outline',
          '@storybook/addon-toolbars': 'storybook/internal/toolbars',
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
        storiesPaths: [],
        configDir: '.storybook',
        storybookVersion: '8.0.0',
        mainConfigPath: '.storybook/main.ts',
        mainConfig: {} as StorybookConfigRaw,
        dryRun: true,
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
        configDir: '.storybook',
        storiesPaths: [],
        storybookVersion: '8.0.0',
        mainConfigPath: 'main.ts',
        mainConfig: {} as StorybookConfigRaw,
      });

      expect(mockPackageManager.runPackageCommand).not.toHaveBeenCalled();
    });
  });
});

describe('moveEssentialOptions', () => {
  it('should move essential options to features', async () => {
    const main = await readConfig('main.ts');
    await moveEssentialOptions(false, {
      docs: false,
      backgrounds: false,
      measure: false,
      outline: false,
      grid: false,
    })(main);

    expect(dedent(formatConfig(main))).toMatchInlineSnapshot(`
      "export default {
        stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
        addons: ['@storybook/addon-links'],

        features: {
          docs: false,
          backgrounds: false,
          measure: false,
          outline: false,
          grid: false
        }
      };"
    `);
  });
});
