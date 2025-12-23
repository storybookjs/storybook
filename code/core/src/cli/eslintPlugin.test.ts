import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as find from 'empathic/find';
import { dedent } from 'ts-dedent';

import type { PackageJsonWithDepsAndDevDeps } from '../common';
import type { JsPackageManager } from '../common/js-package-manager/JsPackageManager';
import {
  configureEslintPlugin,
  extractEslintInfo,
  findEslintFile,
  normalizeExtends,
} from './eslintPlugin';

vi.mock('empathic/find', () => ({
  up: vi.fn(),
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
    primaryPackageJson: {
      packageJson: { dependencies: {}, devDependencies: {} } as PackageJsonWithDepsAndDevDeps,
      packageJsonPath: '/some/path',
      operationDir: '/some/path',
    },
  } satisfies Partial<JsPackageManager>;

  beforeEach(() => {
    vi.mocked(find).up.mockClear();
    mockPackageManager.getAllDependencies.mockClear();
  });

  it('should find ESLint config file with supported extension', async () => {
    vi.mocked(find).up.mockImplementation((fileName) => {
      return String(fileName) === '.eslintrc.js' ? String(fileName) : undefined;
    });

    const result = findEslintFile(process.cwd());
    expect(result).toBe('.eslintrc.js');
  });

  it('should return undefined if no ESLint config file is found', async () => {
    vi.mocked(find).up.mockImplementation(() => undefined);

    const result = findEslintFile(process.cwd());
    expect(result).toBeUndefined();
  });

  it('should throw error for unsupported ESLint config file extensions', async () => {
    vi.mocked(find).up.mockImplementation(() => {
      return '.eslintrc.yaml';
    });

    expect(() => findEslintFile(process.cwd())).toThrowError(
      'Unsupported ESLint config extension: .yaml'
    );
  });

  it('should handle missing ESLint config and no dependencies correctly', async () => {
    mockPackageManager.getAllDependencies.mockReturnValue({});
    mockPackageManager.primaryPackageJson.packageJson = { dependencies: {}, devDependencies: {} };

    vi.mocked(find).up.mockImplementation(() => undefined);

    const result = await extractEslintInfo(mockPackageManager as any);

    expect(result.hasEslint).toBe(false);
    expect(result.isStorybookPluginInstalled).toBe(false);
    expect(result.eslintConfigFile).toBeUndefined();
  });

  it('should extract ESLint info and detect ESLint config and Storybook plugin', async () => {
    mockPackageManager.getAllDependencies.mockReturnValue({
      'eslint-plugin-storybook': '1.0.0',
      eslint: '7.0.0',
    });
    mockPackageManager.primaryPackageJson = {
      packageJson: {
        devDependencies: {},
        dependencies: {},
        eslintConfig: '.eslintrc.js',
      },
      packageJsonPath: '/some/path',
      operationDir: '/some/path',
    };

    vi.mocked(find).up.mockImplementation((fileName) =>
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
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`{
      "extends": ["plugin:storybook/recommended"]
    }`;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: '.eslintrc.json',
        packageManager: mockPackageManager as any,
        isFlatConfig: false,
      });
      expect(vi.mocked(writeFile).mock.calls).toHaveLength(0);
    });

    it('should configure ESLint plugin correctly', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`{
      "extends": ["plugin:other"]
    }`;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: '.eslintrc.json',
        packageManager: mockPackageManager as any,
        isFlatConfig: false,
      });
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

    it('should correctly parse, configure, and preserve comments in comment-json .eslintrc.json', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      // Mock file content with JSON5 features (comments, trailing comma)
      const mockConfigFile = dedent`{
        // Some comment here
        "extends": ["plugin:other"],
        // Top-level comment
        "extends": [
          // Comment before existing item
          "plugin:other", // Inline comment for existing item
        ],
        "rules": {
          // Comment for rules object
          "no-unused-vars": "warn", // Another comment
        },
        // Trailing comment
      }`;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: '.eslintrc.json',
        packageManager: mockPackageManager as any,
        isFlatConfig: false,
      });

      // Expect writeFile to have been called (meaning parsing didn't crash)
      expect(vi.mocked(writeFile)).toHaveBeenCalledTimes(1);
      const [filePath, content] = vi.mocked(writeFile).mock.calls[0];

      expect(filePath).toBe('.eslintrc.json');
      expect(content).toMatchInlineSnapshot(`
        "{
          // Top-level comment
          "extends": [
            // Comment before existing item
            "plugin:other", // Inline comment for existing item
            "plugin:storybook/recommended"
          ],
          "rules": {
            // Comment for rules object
            "no-unused-vars": "warn" // Another comment
          }
          // Trailing comment
        }"
      `);
      // Check that the output contains the new extend AND the original comments
      expect(content).toContain('// Top-level comment');
      expect(content).toContain('plugin:storybook/recommended');
      expect(content).toContain('// Trailing comment');

      // Optionally, check the full snapshot if formatting needs to be precise
      // Note: comment-json might slightly alter whitespace/placement vs original
      expect(content).toMatchInlineSnapshot(`
        "{
          // Top-level comment
          "extends": [
            // Comment before existing item
            "plugin:other", // Inline comment for existing item
            "plugin:storybook/recommended"
          ],
          "rules": {
            // Comment for rules object
            "no-unused-vars": "warn" // Another comment
          }
          // Trailing comment
        }"
      `);
    });
  });

  describe('.eslintrc.js format', () => {
    it('should not configure ESLint plugin if it is already configured', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`
        module.exports = {
          extends: ['plugin:storybook/recommended'],
        };
      `;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: '.eslintrc.js',
        packageManager: mockPackageManager as any,
        isFlatConfig: false,
      });
      expect(vi.mocked(writeFile).mock.calls).toHaveLength(0);
    });

    it('should configure ESLint plugin correctly', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`
        module.exports = {
          extends: ["plugin:other"],
        };
      `;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: '.eslintrc.js',
        packageManager: mockPackageManager as any,
        isFlatConfig: false,
      });
      const [, content] = vi.mocked(writeFile).mock.calls[0];
      expect(content).toMatchInlineSnapshot(`
        "module.exports = {
          extends: ["plugin:other", "plugin:storybook/recommended"],
        };"
      `);
    });
  });

  describe('flat config', () => {
    it('should configure ESLint plugin correctly with default JS flat config', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`
        import somePlugin from 'some-plugin';
        export default [
          somePlugin,
        ]
      `;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: 'eslint.config.js',
        packageManager: mockPackageManager as any,
        isFlatConfig: true,
      });
      const [, content] = vi.mocked(writeFile).mock.calls[0];
      expect(content).toMatchInlineSnapshot(`
        "// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
        import storybook from "eslint-plugin-storybook";

        import somePlugin from 'some-plugin';
        export default [somePlugin, ...storybook.configs["flat/recommended"]];"
      `);
    });

    it('should configure ESLint plugin correctly with typescript-eslint flat config', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`
        import somePlugin from 'some-plugin';
        import tseslint from 'typescript-eslint';
        export default tseslint.config(somePlugin);
      `;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: 'eslint.config.ts',
        packageManager: mockPackageManager as any,
        isFlatConfig: true,
      });
      const [, content] = vi.mocked(writeFile).mock.calls[0];
      expect(content).toMatchInlineSnapshot(`
        "// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
        import storybook from "eslint-plugin-storybook";

        import somePlugin from 'some-plugin';
        import tseslint from 'typescript-eslint';
        export default tseslint.config(somePlugin, storybook.configs["flat/recommended"]);"
      `);
    });

    it('should configure ESLint plugin correctly with reexported const declaration', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`import eslint from "@eslint/js";
        const options = [
          eslint.configs.recommended,
        ]

        export default options;
      `;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: 'eslint.config.ts',
        packageManager: mockPackageManager as any,
        isFlatConfig: true,
      });
      const [, content] = vi.mocked(writeFile).mock.calls[0];
      expect(content).toMatchInlineSnapshot(`
        "// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
        import storybook from "eslint-plugin-storybook";

        import eslint from "@eslint/js";
        const options = [eslint.configs.recommended, ...storybook.configs["flat/recommended"]]

        export default options;"
      `);
    });

    it('should configure ESLint plugin correctly with TS aliased config', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`import eslint from "@eslint/js";
        const options = [
          eslint.configs.recommended,
        ] as Config

        export default options;`;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: 'eslint.config.js',
        packageManager: mockPackageManager as any,
        isFlatConfig: true,
      });
      const [, content] = vi.mocked(writeFile).mock.calls[0];
      expect(content).toMatchInlineSnapshot(`
        "// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
        import storybook from "eslint-plugin-storybook";

        import eslint from "@eslint/js";
        const options = [eslint.configs.recommended, ...storybook.configs["flat/recommended"]] as Config

        export default options;"
      `);
    });

    it('should configure ESLint plugin correctly with TS satisfies config', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`import eslint from "@eslint/js";
        export default [
          eslint.configs.recommended,
        ] satisfies Config;`;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: 'eslint.config.ts',
        packageManager: mockPackageManager as any,
        isFlatConfig: true,
      });
      const [, content] = vi.mocked(writeFile).mock.calls[0];
      expect(content).toMatchInlineSnapshot(`
        "// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
        import storybook from "eslint-plugin-storybook";

        import eslint from "@eslint/js";
        export default [eslint.configs.recommended, ...storybook.configs["flat/recommended"]] satisfies Config;"
      `);
    });

    it('should just add an import if config is of custom unknown format', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`import someCustomConfig from 'my-eslint-config';
      export default someCustomConfig({}, [{}]);`;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: 'eslint.config.js',
        packageManager: mockPackageManager as any,
        isFlatConfig: true,
      });
      const [, content] = vi.mocked(writeFile).mock.calls[0];
      expect(content).toMatchInlineSnapshot(`
        "// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
        import storybook from "eslint-plugin-storybook";

        import someCustomConfig from 'my-eslint-config';
        export default someCustomConfig({}, [{}]);"
      `);
    });

    it('should configure ESLint plugin correctly with array containing spread elements', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`
        import js from '@eslint/js';
        export default [
          ...js.configs.recommended,
        ]
      `;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: 'eslint.config.js',
        packageManager: mockPackageManager as any,
        isFlatConfig: true,
      });
      const [, content] = vi.mocked(writeFile).mock.calls[0];
      expect(content).toMatchInlineSnapshot(`
        "// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
        import storybook from "eslint-plugin-storybook";

        import js from '@eslint/js';
        export default [...js.configs.recommended, ...storybook.configs["flat/recommended"]];"
      `);
    });

    it('should configure ESLint plugin correctly with tseslint.config called with array argument', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`
        import tseslint from 'typescript-eslint';
        export default tseslint.config([
          {
            rules: {
              'no-console': 'error'
            }
          }
        ]);
      `;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: 'eslint.config.js',
        packageManager: mockPackageManager as any,
        isFlatConfig: true,
      });
      const [, content] = vi.mocked(writeFile).mock.calls[0];
      expect(content).toMatchInlineSnapshot(`
        "// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
        import storybook from "eslint-plugin-storybook";

        import tseslint from 'typescript-eslint';
        export default tseslint.config([
          {
            rules: {
              'no-console': 'error'
            }
          }
        ], storybook.configs["flat/recommended"]);"
      `);
    });

    it('should just add an import if config is imported from another module', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`
        import myConfig from './my-eslint-config.js';
        export default myConfig;
      `;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: 'eslint.config.js',
        packageManager: mockPackageManager as any,
        isFlatConfig: true,
      });
      const [, content] = vi.mocked(writeFile).mock.calls[0];
      expect(content).toMatchInlineSnapshot(`
        "// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
        import storybook from "eslint-plugin-storybook";

        import myConfig from './my-eslint-config.js';
        export default myConfig;"
      `);
    });

    it('should configure ESLint plugin correctly with CommonJS module.exports array', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`
        const js = require('@eslint/js');
        module.exports = [
          js.configs.recommended,
        ];
      `;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: 'eslint.config.cjs',
        packageManager: mockPackageManager as any,
        isFlatConfig: true,
      });
      const [, content] = vi.mocked(writeFile).mock.calls[0];
      expect(content).toMatchInlineSnapshot(`
        "// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
        const storybook = require("eslint-plugin-storybook");

        const js = require('@eslint/js');
        module.exports = [js.configs.recommended, ...storybook.configs["flat/recommended"]];"
      `);
    });

    it('should configure ESLint plugin correctly with CommonJS module.exports and tseslint.config', async () => {
      const mockPackageManager = {
        getAllDependencies: vi.fn(),
      } satisfies Partial<JsPackageManager>;

      const mockConfigFile = dedent`
        const tseslint = require('typescript-eslint');
        module.exports = tseslint.config({
          rules: {
            'no-console': 'error'
          }
        });
      `;

      vi.mocked(readFile).mockResolvedValue(mockConfigFile);

      await configureEslintPlugin({
        eslintConfigFile: 'eslint.config.cjs',
        packageManager: mockPackageManager as any,
        isFlatConfig: true,
      });
      const [, content] = vi.mocked(writeFile).mock.calls[0];
      expect(content).toMatchInlineSnapshot(`
        "// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
        const storybook = require("eslint-plugin-storybook");

        const tseslint = require('typescript-eslint');
        module.exports = tseslint.config({
          rules: {
            'no-console': 'error'
          }
        }, storybook.configs["flat/recommended"]);"
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
