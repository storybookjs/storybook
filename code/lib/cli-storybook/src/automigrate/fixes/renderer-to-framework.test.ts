import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import {
  packageUsesRenderer,
  removeRendererInPackageJson,
  transformSourceFiles,
} from './renderer-to-framework.ts';
import { rendererToFramework } from './renderer-to-framework.ts';

const { mockGlobby } = vi.hoisted(() => ({ mockGlobby: vi.fn() }));

vi.mock('node:fs/promises');
vi.mock('globby', () => ({
  globby: mockGlobby,
}));
vi.mock('p-limit', () => ({
  default: vi.fn(() => vi.fn((fn) => fn())),
}));
vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal()),
  commonGlobOptions: () => ({}),
  getProjectRoot: () => '/project/root',
}));

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

  it('removes the renderer on the first run and is unchanged on the second', async () => {
    let contents = JSON.stringify(mockPackageJson);
    const packageManager = {
      writePackageJson: vi.fn((packageJson) => {
        contents = JSON.stringify(packageJson);
      }),
    };

    vi.mocked(readFile).mockImplementation(() => Promise.resolve(contents));

    await expect(
      removeRendererInPackageJson('test/package.json', '@storybook/react', false, packageManager)
    ).resolves.toBe(true);
    await expect(
      removeRendererInPackageJson('test/package.json', '@storybook/react', false, packageManager)
    ).resolves.toBe(false);

    expect(packageManager.writePackageJson).toHaveBeenCalledTimes(1);
    expect(packageManager.writePackageJson).toHaveBeenCalledWith(
      {
        dependencies: {
          '@storybook/react-vite': '^9.0.0',
          react: '^18.0.0',
        },
        devDependencies: {
          '@storybook/addon-essentials': '^9.0.0',
          '@storybook/manager-api': '^9.0.0',
          typescript: '^5.0.0',
        },
      },
      'test'
    );
    expect(writeFile).not.toHaveBeenCalled();
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

describe('packageUsesRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps a renderer used through a subpath import', async () => {
    mockGlobby.mockResolvedValue(['test/preview.ts']);
    vi.mocked(readFile).mockResolvedValue(
      `import type { Preview } from '@storybook/react/preview';`
    );

    await expect(packageUsesRenderer('test/package.json', '@storybook/react')).resolves.toBe(true);
  });
});

describe('run', () => {
  const run = rendererToFramework.run!;
  const migrationResult = {
    migrations: [
      {
        framework: '@storybook/react-vite',
        renderer: '@storybook/react',
        packageJsonFiles: ['/project/package.json'],
      },
    ],
  };

  const packageJson = JSON.stringify(mockPackageJson);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readFile).mockImplementation((file) =>
      Promise.resolve(file === '/project/package.json' ? packageJson : '')
    );
    mockGlobby.mockImplementation((patterns, options) => {
      if (patterns[0] === '/project/.storybook/**/*') {
        return Promise.resolve(['/project/.storybook/preview.ts']);
      }

      return Promise.resolve(
        options?.dot && patterns[0].includes('mdx')
          ? ['/project/.storybook/preview.ts', '/project/stories.mdx']
          : []
      );
    });
  });

  it('keeps the renderer for a subpath import in a hidden config file', async () => {
    vi.mocked(readFile).mockImplementation((file) =>
      Promise.resolve(
        file === '/project/.storybook/preview.ts'
          ? `import type { Preview } from '@storybook/react/preview';`
          : packageJson
      )
    );
    const packageManager = { writePackageJson: vi.fn() };

    await run({
      configDir: '/project/.storybook',
      packageManager,
      result: migrationResult,
      storiesPaths: [],
    } as never);

    expect(packageManager.writePackageJson).not.toHaveBeenCalled();
  });

  it('keeps the renderer for a subpath import in an MDX story', async () => {
    vi.mocked(readFile).mockImplementation((file) =>
      Promise.resolve(
        file === '/project/stories.mdx'
          ? `import type { Preview } from '@storybook/react/preview';`
          : packageJson
      )
    );
    const packageManager = { writePackageJson: vi.fn() };

    await run({
      configDir: '/project/.storybook',
      packageManager,
      result: migrationResult,
      storiesPaths: ['/project/stories.mdx'],
    } as never);

    expect(packageManager.writePackageJson).not.toHaveBeenCalled();
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
      migrations: [
        {
          framework: '@storybook/react-vite',
          renderer: '@storybook/react',
          packageJsonFiles: ['package.json'],
        },
      ],
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
      migrations: [
        {
          framework: '@storybook/react-vite',
          renderer: '@storybook/react',
          packageJsonFiles: ['package.json'],
        },
        {
          framework: '@storybook/vue3-vite',
          renderer: '@storybook/vue3',
          packageJsonFiles: ['packages/app/package.json'],
        },
      ],
    });
  });

  it('keeps a renderer in a package without its replacement framework', async () => {
    const packageJsonFiles = ['package.json', 'packages/shared/package.json'];
    const mockPackageManager = {
      packageJsonPaths: packageJsonFiles,
    };

    vi.mocked(readFile)
      .mockResolvedValueOnce(JSON.stringify(mockPackageJson))
      .mockResolvedValueOnce(
        JSON.stringify({
          dependencies: {
            '@storybook/react': '^9.0.0',
          },
        })
      );

    const options = { packageManager: mockPackageManager } as Parameters<
      typeof rendererToFramework.check
    >[0];

    await expect(rendererToFramework.check(options)).resolves.toEqual({
      migrations: [
        {
          framework: '@storybook/react-vite',
          renderer: '@storybook/react',
          packageJsonFiles: ['package.json'],
        },
      ],
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
