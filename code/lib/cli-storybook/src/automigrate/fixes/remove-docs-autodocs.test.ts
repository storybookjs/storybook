import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager, PackageJson } from 'storybook/internal/common';
import { loadConfig, writeConfig } from 'storybook/internal/csf-tools';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import type { CheckOptions, Fix } from '../types';
import { removeDocsAutodocs } from './remove-docs-autodocs';

// Mock ConfigFile type
interface MockConfigFile {
  getFieldValue: (path: string[]) => any;
  getSafeFieldValue: (path: string[]) => any;
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

vi.mock('storybook/internal/csf-tools', () => ({
  loadConfig: vi.fn().mockImplementation((path) => {
    const config = mockConfigs.get(path);
    if (!config) {
      throw new Error(`No mock config found for ${path}`);
    }
    return {
      parse: () => config,
    };
  }),
  writeConfig: vi.fn(),
}));

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

const typedRemoveDocsAutodocs = removeDocsAutodocs as Required<
  Fix<{ autodocs: boolean | 'tag' | undefined }>
>;

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
      const getSafeFieldValue = vi.fn().mockReturnValue(undefined);
      const mockMain: MockConfigFile = {
        getFieldValue: vi.fn(),
        getSafeFieldValue,
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
      expect(vi.mocked(getSafeFieldValue)).toHaveBeenCalledWith(['docs', 'autodocs']);
    });

    it('detects docs.autodocs when present with tag value', async () => {
      const getSafeFieldValue = vi.fn().mockReturnValue('tag');
      const mockMain: MockConfigFile = {
        getFieldValue: vi.fn(),
        getSafeFieldValue,
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
        autodocs: 'tag',
      });
      expect(vi.mocked(getSafeFieldValue)).toHaveBeenCalledWith(['docs', 'autodocs']);
    });

    it('detects docs.autodocs when present with true value', async () => {
      const getSafeFieldValue = vi.fn().mockReturnValue(true);
      const mockMain: MockConfigFile = {
        getFieldValue: vi.fn(),
        getSafeFieldValue,
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
          docs: { autodocs: true },
        } as StorybookConfigRaw,
      });
      expect(result).toEqual({
        autodocs: true,
      });
      expect(vi.mocked(getSafeFieldValue)).toHaveBeenCalledWith(['docs', 'autodocs']);
    });
  });

  describe('run phase', () => {
    it('removes docs.autodocs field when present with tag value', async () => {
      const setFieldValue = vi.fn();
      const getFieldValue = vi.fn().mockReturnValue({ autodocs: 'tag', defaultName: 'Docs' });
      const mockMain: MockConfigFile = {
        getFieldValue,
        getSafeFieldValue: vi.fn(),
        setFieldValue,
        removeField: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);

      await typedRemoveDocsAutodocs.run({
        result: { autodocs: 'tag' },
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        storybookVersion: '9.0.0',
        mainConfig: {} as StorybookConfigRaw,
      });

      expect(vi.mocked(getFieldValue)).toHaveBeenCalledWith(['docs']);
      expect(vi.mocked(setFieldValue)).toHaveBeenCalledWith(['docs'], { defaultName: 'Docs' });
    });

    it('removes docs.autodocs field and updates preview.js when autodocs is true', async () => {
      const mainGetFieldValue = vi.fn().mockReturnValue({ autodocs: true });
      const previewGetFieldValue = vi.fn().mockReturnValue(['existing-tag']);
      const mockMain: MockConfigFile = {
        getFieldValue: mainGetFieldValue,
        getSafeFieldValue: vi.fn(),
        setFieldValue: vi.fn(),
        removeField: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };
      const mockPreview: MockConfigFile = {
        getFieldValue: previewGetFieldValue,
        getSafeFieldValue: vi.fn(),
        setFieldValue: vi.fn(),
        removeField: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);
      mockConfigs.set('preview.ts', mockPreview);

      await typedRemoveDocsAutodocs.run({
        result: { autodocs: true },
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        previewConfigPath: 'preview.ts',
        storybookVersion: '9.0.0',
        mainConfig: {} as StorybookConfigRaw,
      });

      expect(mainGetFieldValue).toHaveBeenCalledWith(['docs']);
      expect(previewGetFieldValue).toHaveBeenCalledWith(['tags']);
      expect(mockPreview.setFieldValue).toHaveBeenCalledWith(
        ['tags'],
        ['existing-tag', 'autodocs']
      );
      expect(vi.mocked(writeConfig)).toHaveBeenCalled();
    });

    it('adds autodocs tag to empty tags array in preview.js when autodocs is true', async () => {
      const mainGetFieldValue = vi.fn().mockReturnValue({ autodocs: true });
      const previewGetFieldValue = vi.fn().mockReturnValue(undefined);
      const mockMain: MockConfigFile = {
        getFieldValue: mainGetFieldValue,
        getSafeFieldValue: vi.fn(),
        setFieldValue: vi.fn(),
        removeField: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };
      const mockPreview: MockConfigFile = {
        getFieldValue: previewGetFieldValue,
        getSafeFieldValue: vi.fn(),
        setFieldValue: vi.fn(),
        removeField: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);
      mockConfigs.set('preview.ts', mockPreview);

      await typedRemoveDocsAutodocs.run({
        result: { autodocs: true },
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        previewConfigPath: 'preview.ts',
        storybookVersion: '9.0.0',
        mainConfig: {} as StorybookConfigRaw,
      });

      expect(mainGetFieldValue).toHaveBeenCalledWith(['docs']);
      expect(previewGetFieldValue).toHaveBeenCalledWith(['tags']);
      expect(mockPreview.setFieldValue).toHaveBeenCalledWith(['tags'], ['autodocs']);
      expect(vi.mocked(writeConfig)).toHaveBeenCalled();
    });

    it('does nothing in dry run mode', async () => {
      const setFieldValue = vi.fn();
      const removeField = vi.fn();
      const getFieldValue = vi.fn().mockReturnValue({ autodocs: true });
      const mockMain: MockConfigFile = {
        getFieldValue,
        getSafeFieldValue: vi.fn(),
        setFieldValue,
        removeField,
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };
      const mockPreview: MockConfigFile = {
        getFieldValue: vi.fn().mockReturnValue(['existing-tag']),
        getSafeFieldValue: vi.fn(),
        setFieldValue: vi.fn(),
        removeField: vi.fn(),
        _ast: {},
        _code: '',
        _exports: {},
        _exportDecls: [],
      };

      mockConfigs.set('main.ts', mockMain);
      mockConfigs.set('preview.ts', mockPreview);

      await typedRemoveDocsAutodocs.run({
        result: { autodocs: true },
        packageManager: mockPackageManager,
        packageJson: mockPackageJson,
        mainConfigPath: 'main.ts',
        previewConfigPath: 'preview.ts',
        storybookVersion: '9.0.0',
        mainConfig: {} as StorybookConfigRaw,
        dryRun: true,
      });

      expect(vi.mocked(getFieldValue)).toHaveBeenCalledWith(['docs']);
      expect(vi.mocked(setFieldValue)).not.toHaveBeenCalled();
      expect(vi.mocked(removeField)).not.toHaveBeenCalled();
      expect(mockPreview.setFieldValue).not.toHaveBeenCalled();
      expect(vi.mocked(writeConfig)).not.toHaveBeenCalled();
    });
  });
});
