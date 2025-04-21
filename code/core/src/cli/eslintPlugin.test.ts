import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findUp } from 'find-up';
import { dedent } from 'ts-dedent';

import type { JsPackageManager } from '../common/js-package-manager/JsPackageManager';
import {
  configureEslintPlugin,
  extractEslintInfo,
  findEslintFile,
  normalizeExtends,
} from './eslintPlugin';

vi.mock('find-up', () => ({
  findUp: vi.fn(),
}));

vi.mock(import('node:fs/promises'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
  };
});

describe('extractEslintInfo', () => {
  const mockPackageManager = {
    getAllDependencies: vi.fn(),
    retrievePackageJson: vi.fn(),
  } satisfies Partial<JsPackageManager>;

  beforeEach(() => {
    vi.mocked(findUp).mockClear();
    mockPackageManager.getAllDependencies.mockClear();
    mockPackageManager.retrievePackageJson.mockClear();
  });

  it('should find ESLint config file with supported extension', async () => {
    vi.mocked(findUp).mockImplementation(async (fileName) => {
      return String(fileName) === '.eslintrc.js' ? String(fileName) : undefined;
    });

    const result = await findEslintFile();
    expect(result).toBe('.eslintrc.js');
  });

  it('should return undefined if no ESLint config file is found', async () => {
    vi.mocked(findUp).mockImplementation(async () => undefined);

    const result = await findEslintFile();
    expect(result).toBeUndefined();
  });

  it('should throw error for unsupported ESLint config file extensions', async () => {
    vi.mocked(findUp).mockImplementation(async () => {
      return '.eslintrc.yaml';
    });

    await expect(findEslintFile()).rejects.toThrowError(
      'Unsupported ESLint config extension: .yaml'
    );
  });

  it('should handle missing ESLint config and no dependencies correctly', async () => {
    mockPackageManager.getAllDependencies.mockResolvedValue({});
    mockPackageManager.retrievePackageJson.mockResolvedValue({});

    vi.mocked(findUp).mockImplementation(async () => undefined);

    const result = await extractEslintInfo(mockPackageManager as any);

    expect(result.hasEslint).toBe(false);
    expect(result.isStorybookPluginInstalled).toBe(false);
    expect(result.eslintConfigFile).toBeUndefined();
  });

  it('should extract ESLint info and detect ESLint config and Storybook plugin', async () => {
    mockPackageManager.getAllDependencies.mockResolvedValue({
      'eslint-plugin-storybook': '1.0.0',
      eslint: '7.0.0',
    });
    mockPackageManager.retrievePackageJson.mockResolvedValue({
      eslintConfig: '.eslintrc.js',
    });

    vi.mocked(findUp).mockImplementation(async (fileName) =>
      String(fileName) === '.eslintrc.js' ? String(fileName) : undefined
    );

    const result = await extractEslintInfo(mockPackageManager as any);

    expect(result.hasEslint).toBe(true);
    expect(result.isStorybookPluginInstalled).toBe(true);
    expect(result.eslintConfigFile).toBe('.eslintrc.js');
    expect(result.isFlatConfig).toBe(false);
  });
});

describe('configureEslintPlugin', () => {
  describe('.eslintrc.json format', () => {
    it('should not configure ESLint plugin if it is already configured', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
        retrievePackageJson: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`{
      "extends": ["plugin:storybook/recommended"]
    }`;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin('.eslintrc.json', mockPackageManager as any);
      expect(vi.mocked(writeFile).mock.calls).toHaveLength(0);
    });

    it('should configure ESLint plugin correctly', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
        retrievePackageJson: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`{
      "extends": ["plugin:other"]
    }`;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin('.eslintrc.json', mockPackageManager as any);
      const [filePath, content] = vi.mocked(writeFile).mock.calls[0];
      expect(filePath).toBe('.eslintrc.json');
      expect(content).toMatchInlineSnapshot(`
      "{
        "extends": [
          "plugin:other",
          "plugin:storybook/recommended"
        ]
      }"
    `);
    });
  });

  describe('.eslintrc.js format', () => {
    it('should not configure ESLint plugin if it is already configured', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
        retrievePackageJson: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`
        module.exports = {
          extends: ['plugin:storybook/recommended'],
        };
      `;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin('.eslintrc.js', mockPackageManager as any);
      expect(vi.mocked(writeFile).mock.calls).toHaveLength(0);
    });

    it('should configure ESLint plugin correctly', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
        retrievePackageJson: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`
        module.exports = {
          extends: ['plugin:other'],
        };
      `;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin('.eslintrc.js', mockPackageManager as any);
      const [filePath, content] = vi.mocked(writeFile).mock.calls[0];
      expect(filePath).toBe('.eslintrc.js');
      expect(content).toMatchInlineSnapshot(`
        "module.exports = {
          extends: ['plugin:other', 'plugin:storybook/recommended'],
        };"
      `);
    });
  });

  // TODO: Enable these tests once we support setting up flat config format
  describe.todo('flat config', () => {
    it('should configure ESLint plugin correctly with default flat config', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
        retrievePackageJson: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`
        import somePlugin from 'some-plugin';
        export default [
          somePlugin,
        ]
      `;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin('eslint.config.js', mockPackageManager as any);
      const [filePath, content] = vi.mocked(writeFile).mock.calls[0];
      expect(filePath).toBe('eslint.config.js');
      expect(content).toMatchInlineSnapshot(`
        "import somePlugin from 'some-plugin';
        import storybook from 'eslint-plugin-storybook';
        export default [
          somePlugin,
          storybook.configs['flat/recommended'],
        ];"
      `);
    });

    it('should configure ESLint plugin correctly with typescript-eslint flat config', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
        retrievePackageJson: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`
        import somePlugin from 'some-plugin';
        import tseslint from 'typescript-eslint';
        export default tseslint.config(somePlugin);
      `;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin('eslint.config.js', mockPackageManager as any);
      const [filePath, content] = vi.mocked(writeFile).mock.calls[0];
      expect(filePath).toBe('eslint.config.js');
      expect(content).toMatchInlineSnapshot(`
        "import somePlugin from 'some-plugin';
        import tseslint from 'typescript-eslint';
        import storybook from 'eslint-plugin-storybook';
        export default tseslint.config(somePlugin, storybook.configs['flat/recommended']);"
      `);
    });
  });
});

describe('normalizeExtends', () => {
  it('returns empty array when existingExtends is falsy', () => {
    expect(normalizeExtends(null)).toEqual([]);
    expect(normalizeExtends(undefined)).toEqual([]);
  });

  it('returns existingExtends when it is a string', () => {
    expect(normalizeExtends('foo')).toEqual(['foo']);
  });

  it('returns existingExtends when it is an array', () => {
    expect(normalizeExtends(['foo'])).toEqual(['foo']);
  });

  it('throws when existingExtends is not a string or array', () => {
    expect(() => normalizeExtends(true)).toThrowError('Invalid eslint extends true');
  });
});
