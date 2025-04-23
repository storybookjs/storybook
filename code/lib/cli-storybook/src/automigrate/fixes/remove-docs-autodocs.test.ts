import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager, PackageJson } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import type { CheckOptions, Fix } from '../types';
import { removeDocsAutodocs } from './remove-docs-autodocs';

// Mock ConfigFile type
interface MockConfigFile {
  getFieldValue: (path: string[]) => any;
  setFieldValue: (path: string[], value: any) => void;
  removeField: (path: string[]) => void;
  _ast: Record<string, unknown>;
  _code: string;
  _exports: Record<string, unknown>;
  _exportDecls: unknown[];
}

// Store mock configs by path
const mockConfigs = new Map<string, MockConfigFile>();

vi.mock('../helpers/mainConfigFile', () => {
  const updateMainConfig = vi.fn().mockImplementation(({ mainConfigPath }, callback) => {
    const config = mockConfigs.get(mainConfigPath);

    if (!config) {
      throw new Error(`No mock config found for ${mainConfigPath}`);
    }
    return callback(config);
  });
  return { updateMainConfig };
});

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
  } as StorybookConfigRaw,
  storybookVersion: '9.0.0',
  configDir: '.storybook',
};

const typedRemoveDocsAutodocs = removeDocsAutodocs as Required<Fix<{ hasAutodocs: boolean }>>;

describe('remove-docs-autodocs migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigs.clear();
  });

  describe('check phase', () => {
    it('returns null if no mainConfigPath provided', async () => {
      const result = await typedRemoveDocsAutodocs.check(baseCheckOptions);
      expect(result).toBeNull();
    });

    it('returns null if docs.autodocs not found in config', async () => {
      const getFieldValue = vi.fn().mockReturnValue({});
      const mockMain: MockConfigFile = {
        getFieldValue,
        setFieldValue: vi.fn(),
        removeField: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);

      const result = await typedRemoveDocsAutodocs.check({
        ...baseCheckOptions,
        mainConfigPath: 'main.ts',
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          docs: {},
        } as StorybookConfigRaw,
      });
      expect(result).toBeNull();
      expect(vi.mocked(getFieldValue)).toHaveBeenCalledWith(['docs']);
    });

    it('detects docs.autodocs when present', async () => {
      const getFieldValue = vi.fn().mockReturnValue({ autodocs: 'tag' });
      const mockMain: MockConfigFile = {
        getFieldValue,
        setFieldValue: vi.fn(),
        removeField: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);

      const result = await typedRemoveDocsAutodocs.check({
        ...baseCheckOptions,
        mainConfigPath: 'main.ts',
        mainConfig: {
          stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
          docs: { autodocs: 'tag' },
        } as StorybookConfigRaw,
      });
      expect(result).toEqual({
        hasAutodocs: true,
      });
      expect(vi.mocked(getFieldValue)).toHaveBeenCalledWith(['docs']);
    });
  });

  describe('run phase', () => {
    it('removes docs.autodocs field when present', async () => {
      const setFieldValue = vi.fn();
      const getFieldValue = vi.fn().mockReturnValue({ autodocs: 'tag', defaultName: 'Docs' });
      const mockMain: MockConfigFile = {
        getFieldValue,
        setFieldValue,
        removeField: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);

      await typedRemoveDocsAutodocs.run({
        result: { hasAutodocs: true },
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        storybookVersion: '9.0.0',
        mainConfig: {} as StorybookConfigRaw,
      });

      expect(vi.mocked(getFieldValue)).toHaveBeenCalledWith(['docs']);
      expect(vi.mocked(setFieldValue)).toHaveBeenCalledWith(['docs'], { defaultName: 'Docs' });
    });

    it('removes entire docs field when autodocs is the only property', async () => {
      const removeField = vi.fn();
      const getFieldValue = vi.fn().mockReturnValue({ autodocs: 'tag' });
      const mockMain: MockConfigFile = {
        getFieldValue,
        setFieldValue: vi.fn(),
        removeField,
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);

      await typedRemoveDocsAutodocs.run({
        result: { hasAutodocs: true },
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        storybookVersion: '9.0.0',
        mainConfig: {} as StorybookConfigRaw,
      });

      expect(vi.mocked(getFieldValue)).toHaveBeenCalledWith(['docs']);
      expect(vi.mocked(removeField)).toHaveBeenCalledWith(['docs']);
    });

    it('does nothing in dry run mode', async () => {
      const setFieldValue = vi.fn();
      const removeField = vi.fn();
      const getFieldValue = vi.fn().mockReturnValue({ autodocs: 'tag' });
      const mockMain: MockConfigFile = {
        getFieldValue,
        setFieldValue,
        removeField,
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);

      await typedRemoveDocsAutodocs.run({
        result: { hasAutodocs: true },
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        storybookVersion: '9.0.0',
        mainConfig: {} as StorybookConfigRaw,
        dryRun: true,
      });

      expect(vi.mocked(getFieldValue)).toHaveBeenCalledWith(['docs']);
      expect(vi.mocked(setFieldValue)).not.toHaveBeenCalled();
      expect(vi.mocked(removeField)).not.toHaveBeenCalled();
    });
  });
});
