import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import {
  consolidatedImports,
  transformImportFiles,
  transformPackageJsonFiles,
} from './consolidated-imports';

// mock picocolors yellow and cyan
vi.mock('picocolors', () => {
  return {
    default: {
      cyan: (str: string) => str,
      red: (str: string) => str,
    },
  };
});

vi.mock('node:fs/promises');
vi.mock('globby', () => ({
  globby: vi.fn(),
}));

const mockPackageJson = {
  dependencies: {
    '@storybook/react': '^7.0.0',
    '@storybook/core-common': '^7.0.0',
    react: '^18.0.0',
  },
  devDependencies: {
    '@storybook/addon-essentials': '^7.0.0',
    '@storybook/manager-api': '^7.0.0',
    typescript: '^5.0.0',
  },
};

const mockRunOptions = {
  packageManager: {
    retrievePackageJson: async () => mockPackageJson,
  } as any,
  mainConfig: {} as any,
  mainConfigPath: 'main.ts',
  packageJson: mockPackageJson,
};

const setupGlobby = async (files: string[]) => {
  // eslint-disable-next-line depend/ban-dependencies
  const { globby } = await import('globby');
  vi.mocked(globby).mockResolvedValueOnce(files);
};

const setupCheck = async (packageJsonContents: string, packageJsonFiles: string[]) => {
  vi.mocked(readFile).mockImplementation(async (path: any) => {
    const filePath = path.toString();
    if (filePath.endsWith('package.json')) {
      return packageJsonContents;
    }
    return '';
  });
  await setupGlobby(packageJsonFiles);

  return consolidatedImports.check({
    ...mockRunOptions,
    storybookVersion: '8.0.0',
  });
};

describe('check', () => {
  it('should call globby with correct patterns for package.json files', async () => {
    const filePath = 'test/package.json';
    const contents = JSON.stringify(mockPackageJson);

    await setupCheck(contents, [filePath]);

    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    expect(globby).toHaveBeenCalledWith(
      ['**/package.json'],
      expect.objectContaining({
        ignore: ['**/node_modules/**'],
      })
    );
  });

  it('should detect consolidated packages in package.json', async () => {
    const contents = JSON.stringify(mockPackageJson);
    const filePath = 'test/package.json';

    const result = await setupCheck(contents, [filePath]);
    expect(result).toMatchObject({
      packageJsonFiles: [filePath],
    });
  });

  it('should not detect non-consolidated packages in package.json', async () => {
    const packageJsonWithoutConsolidated = {
      dependencies: {
        react: '^18.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
      },
    };
    const contents = JSON.stringify(packageJsonWithoutConsolidated);
    const filePath = 'test/package.json';

    const result = await setupCheck(contents, [filePath]);
    expect(result).toBeNull();
  });
});

describe('prompt', () => {
  it('should return a prompt', () => {
    const result = consolidatedImports.prompt({
      packageJsonFiles: ['test/package.json'],
      consolidatedDeps: new Set(['@storybook/core-common', '@storybook/experimental-nextjs-vite']),
    });

    expect(result).toMatchInlineSnapshot(`
  "Found package.json files that contain consolidated or renamed Storybook packages that need to be updated:
  - test/package.json

  We will automatically rename the following packages:
  - @storybook/core-common -> storybook/internal/common
  - @storybook/experimental-nextjs-vite -> @storybook/nextjs-vite

  These packages have been renamed or consolidated into the main storybook package and should be removed.
  The main storybook package will be added to devDependencies if not already present.

  Would you like to:
  1. Update these package.json files
  2. Scan your codebase and update any imports from these updated packages

  This will ensure your project is properly updated to use the new updated package structure and to use the latest package names."
`);
  });
});

describe('transformPackageJsonFiles', () => {
  it('should transform package.json files', async () => {
    const contents = JSON.stringify(mockPackageJson);
    const filePath = 'test/package.json';

    vi.mocked(readFile).mockResolvedValueOnce(contents);

    const errors = await transformPackageJsonFiles([filePath], false);

    expect(errors).toHaveLength(0);
    expect(writeFile).toHaveBeenCalledWith(
      filePath,
      expect.not.stringContaining('"@storybook/core-common": "^8.0.0"')
    );
  });

  it('should not write files in dry run mode', async () => {
    const contents = JSON.stringify(mockPackageJson);
    const filePath = 'test/package.json';

    vi.mocked(readFile).mockResolvedValueOnce(contents);

    const errors = await transformPackageJsonFiles([filePath], true);

    expect(errors).toHaveLength(0);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should handle file read errors', async () => {
    const filePath = 'test/package.json';
    vi.mocked(readFile).mockRejectedValueOnce(new Error('Failed to read file'));

    const errors = await transformPackageJsonFiles([filePath], false);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      file: filePath,
      error: expect.any(Error),
    });
  });

  it('should handle file write errors', async () => {
    const contents = JSON.stringify(mockPackageJson);
    const filePath = 'test/package.json';
    vi.mocked(readFile).mockResolvedValueOnce(contents);
    vi.mocked(writeFile).mockRejectedValueOnce(new Error('Failed to write file'));

    const errors = await transformPackageJsonFiles([filePath], false);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      file: filePath,
      error: expect.any(Error),
    });
  });
});

describe('transformImportFiles', () => {
  it('should transform import declarations', async () => {
    const sourceContents = dedent`
      import { something } from '@storybook/components';
      import { other } from '@storybook/core-common';
    `;
    const sourceFiles = [join('src', 'test.ts')];

    vi.mocked(readFile).mockResolvedValueOnce(sourceContents);

    const errors = await transformImportFiles(sourceFiles, false);

    expect(errors).toHaveLength(0);
    expect(writeFile).toHaveBeenCalledWith(
      sourceFiles[0],
      expect.stringContaining(`from 'storybook/internal/components'`)
    );
  });

  it('should transform import declarations with sub-paths', async () => {
    const sourceContents = dedent`
      import { other } from '@storybook/theming/create';
    `;
    const sourceFiles = [join('src', 'test.ts')];

    vi.mocked(readFile).mockResolvedValueOnce(sourceContents);

    const errors = await transformImportFiles(sourceFiles, false);

    expect(errors).toHaveLength(0);
    expect(writeFile).toHaveBeenCalledWith(
      sourceFiles[0],
      expect.stringContaining(`from 'storybook/theming/create'`)
    );
  });

  it('should transform require calls', async () => {
    const sourceContents = dedent`
      const something = require('@storybook/components');
      const other = require('@storybook/core-common');
    `;
    const sourceFiles = [join('src', 'test.ts')];

    vi.mocked(readFile).mockResolvedValueOnce(sourceContents);

    const errors = await transformImportFiles(sourceFiles, false);

    expect(errors).toHaveLength(0);
    expect(writeFile).toHaveBeenCalledWith(
      sourceFiles[0],
      expect.stringContaining(`require('storybook/internal/components')`)
    );
  });

  it('should handle mixed import styles', async () => {
    const sourceContents = dedent`
      import { something } from '@storybook/components';
      const other = require('@storybook/core-common');
    `;
    const sourceFiles = [join('src', 'test.ts')];

    vi.mocked(readFile).mockResolvedValueOnce(sourceContents);

    const errors = await transformImportFiles(sourceFiles, false);

    expect(errors).toHaveLength(0);
    expect(writeFile).toHaveBeenCalledWith(
      sourceFiles[0],
      expect.stringContaining(`from 'storybook/internal/components'`)
    );
    expect(writeFile).toHaveBeenCalledWith(
      sourceFiles[0],
      expect.stringContaining(`require('storybook/internal/common')`)
    );
  });

  it('should not transform non-consolidated package imports', async () => {
    const sourceContents = `
      import { something } from '@storybook/other-package';
      const other = require('some-other-package');
    `;
    const sourceFiles = [join('src', 'test.ts')];

    vi.mocked(readFile).mockResolvedValueOnce(sourceContents);

    const errors = await transformImportFiles(sourceFiles, false);

    expect(errors).toHaveLength(0);
    expect(writeFile).not.toHaveBeenCalledWith(sourceFiles[0], expect.any(String));
  });

  it('should not write files in dry run mode', async () => {
    const sourceContents = dedent`
      import { something } from '@storybook/components';
    `;
    const sourceFiles = [join('src', 'test.ts')];

    vi.mocked(readFile).mockResolvedValueOnce(sourceContents);

    const errors = await transformImportFiles(sourceFiles, true);

    expect(errors).toHaveLength(0);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should handle file read errors', async () => {
    const sourceFiles = [join('src', 'test.ts')];
    vi.mocked(readFile).mockRejectedValueOnce(new Error('Failed to read file'));

    const errors = await transformImportFiles(sourceFiles, false);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      file: sourceFiles[0],
      error: expect.any(Error),
    });
  });

  it('should handle file write errors', async () => {
    const sourceContents = dedent`
      import { something } from '@storybook/components';
    `;
    const sourceFiles = [join('src', 'test.ts')];
    vi.mocked(readFile).mockResolvedValueOnce(sourceContents);
    vi.mocked(writeFile).mockRejectedValueOnce(new Error('Failed to write file'));

    const errors = await transformImportFiles(sourceFiles, false);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      file: sourceFiles[0],
      error: expect.any(Error),
    });
  });
});
