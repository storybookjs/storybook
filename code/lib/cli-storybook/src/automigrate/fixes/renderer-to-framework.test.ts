import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';

import { removeRendererInPackageJson, transformSourceFiles } from './renderer-to-framework.ts';
import { rendererToFramework } from './renderer-to-framework.ts';

vi.mock('node:fs/promises');
vi.mock('globby', () => ({
  globby: vi.fn(),
}));
vi.mock('p-limit', () => ({
  default: vi.fn(() => vi.fn((fn) => fn())),
}));
vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal()),
  commonGlobOptions: () => ({}),
  getProjectRoot: () => '/project/root',
}));
vi.mock('storybook/internal/node-logger', { spy: true });

const mockPackageJson = {
  dependencies: {
    '@storybook/react': '^9.0.0',
    '@storybook/react-vite': '^9.0.0',
    react: '^18.0.0',
  },
  devDependencies: {
    '@storybook/addon-essentials': '^9.0.0',
    '@storybook/manager-api': '^9.0.0',
    typescript: '^5.0.0',
  },
};

describe('transformSourceFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readFile).mockImplementation(() => Promise.resolve(''));
    vi.mocked(writeFile).mockImplementation(() => Promise.resolve());
  });

  it('should transform multiple files', async () => {
    const sourceContents = dedent`
      import { something } from '@storybook/react';
      import { other } from '@storybook/react-vite';
    `;
    const sourceFiles = [join('src', 'test1.ts'), join('src', 'test2.ts')];

    vi.mocked(readFile).mockResolvedValue(sourceContents);

    const errors = await transformSourceFiles(
      sourceFiles,
      '@storybook/react',
      '@storybook/react-vite',
      false
    );

    expect(errors).toHaveLength(0);
    expect(writeFile).toHaveBeenCalledTimes(2);

    const firstFile = vi.mocked(writeFile).mock.calls[0][1];
    expect(firstFile).toMatchInlineSnapshot(dedent`
      "import { something } from '@storybook/react-vite';
      import { other } from '@storybook/react-vite';"
    `);

    const secondFile = vi.mocked(writeFile).mock.calls[1][1];
    expect(secondFile).toMatchInlineSnapshot(dedent`
      "import { something } from '@storybook/react-vite';
      import { other } from '@storybook/react-vite';"
    `);
  });
  it('should not write files in dry run mode', async () => {
    const sourceContents = dedent`
      import { something } from '@storybook/react';
    `;
    const sourceFiles = [join('src', 'test.ts')];

    vi.mocked(readFile).mockResolvedValue(sourceContents);

    const errors = await transformSourceFiles(
      sourceFiles,
      '@storybook/react',
      '@storybook/react-vite',
      true
    );

    expect(errors).toHaveLength(0);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should handle file read errors', async () => {
    const sourceFiles = [join('src', 'test.ts')];
    vi.mocked(readFile).mockRejectedValueOnce(new Error('Failed to read file'));

    const errors = await transformSourceFiles(
      sourceFiles,
      '@storybook/react',
      '@storybook/react-vite',
      false
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      file: sourceFiles[0],
      error: expect.any(Error),
    });
  });
});

describe('removeRendererInPackageJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readFile).mockImplementation(() => Promise.resolve('{}'));
    vi.mocked(writeFile).mockImplementation(() => Promise.resolve());
  });

  it('should remove renderer packages from dependencies', async () => {
    const contents = JSON.stringify(mockPackageJson);
    const filePath = 'test/package.json';

    vi.mocked(readFile).mockResolvedValueOnce(contents);

    const hasChanges = await removeRendererInPackageJson(filePath, '@storybook/react', false);

    expect(hasChanges).toBe(true);
    const file = vi.mocked(writeFile).mock.calls[0][1];
    expect(file).toMatchInlineSnapshot(dedent`
      "{
        "dependencies": {
          "@storybook/react-vite": "^9.0.0",
          "react": "^18.0.0"
        },
        "devDependencies": {
          "@storybook/addon-essentials": "^9.0.0",
          "@storybook/manager-api": "^9.0.0",
          "typescript": "^5.0.0"
        }
      }"
    `);
  });

  it('should remove renderer packages from devDependencies', async () => {
    const contents = JSON.stringify({
      ...mockPackageJson,
      dependencies: {},
      devDependencies: {
        '@storybook/react-vite': '^9.0.0',
        '@storybook/react': '^9.0.0',
      },
    });
    const filePath = 'test/package.json';

    vi.mocked(readFile).mockResolvedValueOnce(contents);

    const hasChanges = await removeRendererInPackageJson(filePath, '@storybook/react', false);

    expect(hasChanges).toBe(true);
    const file = vi.mocked(writeFile).mock.calls[0][1];
    expect(file).toMatchInlineSnapshot(dedent`
      "{
        "dependencies": {},
        "devDependencies": {
          "@storybook/react-vite": "^9.0.0"
        }
      }"
    `);
  });

  it('should not write files in dry run mode', async () => {
    const contents = JSON.stringify(mockPackageJson);
    const filePath = 'test/package.json';

    vi.mocked(readFile).mockResolvedValueOnce(contents);

    const hasChanges = await removeRendererInPackageJson(filePath, '@storybook/react', true);

    expect(hasChanges).toBe(true);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should handle file read errors', async () => {
    const filePath = 'test/package.json';
    vi.mocked(readFile).mockRejectedValueOnce(new Error('Failed to read file'));

    await expect(removeRendererInPackageJson(filePath, '@storybook/react', false)).rejects.toThrow(
      'Failed to update package.json'
    );
  });
});

describe('check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readFile).mockImplementation(() => Promise.resolve('{}'));
  });

  it('should detect frameworks and renderers in package.json', async () => {
    const packageJsonFiles = ['package.json'];
    const contents = JSON.stringify(mockPackageJson);
    const mockPackageManager = {
      packageJsonPaths: packageJsonFiles,
    };

    vi.mocked(readFile).mockResolvedValue(contents);

    const result = await rendererToFramework.check({ packageManager: mockPackageManager } as any);

    expect(result).toEqual({
      frameworks: ['@storybook/react-vite'],
      renderers: ['@storybook/react'],
      packageJsonFiles: ['package.json'],
    });
  });

  it('should handle multiple package.json files', async () => {
    const packageJsonFiles = ['package.json', 'packages/app/package.json'];
    const contents1 = JSON.stringify(mockPackageJson);
    const contents2 = JSON.stringify({
      dependencies: {
        '@storybook/vue3': '^9.0.0',
        '@storybook/vue3-vite': '^9.0.0',
      },
    });
    const mockPackageManager = {
      packageJsonPaths: packageJsonFiles,
    };

    vi.mocked(readFile).mockResolvedValueOnce(contents1).mockResolvedValueOnce(contents2);

    const result = await rendererToFramework.check({ packageManager: mockPackageManager } as any);

    expect(result).toEqual({
      frameworks: ['@storybook/react-vite', '@storybook/vue3-vite'],
      renderers: ['@storybook/react', '@storybook/vue3'],
      packageJsonFiles: ['package.json', 'packages/app/package.json'],
    });
  });

  it('should return null when no frameworks found', async () => {
    const packageJsonFiles = ['package.json'];
    const contents = JSON.stringify({
      dependencies: {
        '@storybook/react': '^9.0.0',
        react: '^18.0.0',
      },
    });
    const mockPackageManager = {
      packageJsonPaths: packageJsonFiles,
    };

    vi.mocked(readFile).mockResolvedValue(contents);

    const result = await rendererToFramework.check({ packageManager: mockPackageManager } as any);

    expect(result).toBeNull();
  });

  it('should return null when no renderers found', async () => {
    const packageJsonFiles = ['package.json'];
    const contents = JSON.stringify({
      dependencies: {
        '@storybook/react-vite': '^9.0.0',
        react: '^18.0.0',
      },
    });
    const mockPackageManager = {
      packageJsonPaths: packageJsonFiles,
    };

    vi.mocked(readFile).mockResolvedValue(contents);

    const result = await rendererToFramework.check({ packageManager: mockPackageManager } as any);

    expect(result).toBeNull();
  });

  it('should return null when a renderer was found which is also a framework', async () => {
    const packageJsonFiles = ['package.json'];
    const contents = JSON.stringify({
      dependencies: {
        '@storybook/angular': '^9.0.0',
        angular: '^18.0.0',
      },
    });
    const mockPackageManager = {
      packageJsonPaths: packageJsonFiles,
    };

    vi.mocked(readFile).mockResolvedValue(contents);

    const result = await rendererToFramework.check({ packageManager: mockPackageManager } as any);

    expect(result).toBeNull();
  });

  it('should handle file read errors gracefully', async () => {
    const packageJsonFiles = ['package.json'];
    const mockPackageManager = {
      packageJsonPaths: packageJsonFiles,
    };

    vi.mocked(readFile).mockRejectedValue(new Error('Failed to read file'));

    const result = await rendererToFramework.check({ packageManager: mockPackageManager } as any);

    expect(result).toBeNull();
  });
});

describe('run / detectMissedTransformations onSkip wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readFile).mockImplementation(() => Promise.resolve(''));
    vi.mocked(writeFile).mockImplementation(() => Promise.resolve());
  });

  it('should call logger.warn (with a "skipping" message) when run() cannot resolve a framework', async () => {
    const options = {
      result: {
        frameworks: ['not-a-real-framework'],
        renderers: [],
        packageJsonFiles: [],
      },
      dryRun: true,
      storiesPaths: [],
      configDir: 'test',
    } as any;

    await rendererToFramework.run!(options);

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(expect.stringContaining('skipping'));
  });

  it('should NOT call logger.warn when detectMissedTransformations resolves the same malformed input', () => {
    const pairs = rendererToFramework.detectMissedTransformations!({
      frameworks: ['not-a-real-framework'],
      renderers: [],
      packageJsonFiles: [],
    });

    expect(pairs).toEqual([]);
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
  });
});

describe('detectMissedTransformations', () => {
  it('should return a label and regex for each resolved renderer/framework pair', () => {
    const result = {
      frameworks: ['@storybook/react-vite'],
      renderers: [],
      packageJsonFiles: [],
    };

    const pairs = rendererToFramework.detectMissedTransformations!(result);

    expect(pairs).toEqual([{ label: '@storybook/react', regex: expect.any(RegExp) }]);
  });

  it('should return a regex that matches the plain renderer import specifier', () => {
    const result = {
      frameworks: ['@storybook/react-vite'],
      renderers: [],
      packageJsonFiles: [],
    };

    const pairs = rendererToFramework.detectMissedTransformations!(result);

    expect(pairs[0].regex.test("import x from '@storybook/react'")).toBe(true);
  });

  it('should return a regex that does not match a longer package name sharing the same prefix', () => {
    const result = {
      frameworks: ['@storybook/react-vite'],
      renderers: [],
      packageJsonFiles: [],
    };

    const pairs = rendererToFramework.detectMissedTransformations!(result);

    expect(pairs[0].regex.test("import x from '@storybook/react-vite'")).toBe(false);
  });
});
