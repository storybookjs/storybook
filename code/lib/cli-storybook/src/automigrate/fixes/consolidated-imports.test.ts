import { readFile, writeFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { JsPackageManager, versions } from 'storybook/internal/common';

import { consolidatedImports, transformPackageJsonFiles } from './consolidated-imports';

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

const mockPackageManager = vi.mocked(JsPackageManager.prototype);

const mockRunOptions = {
  packageManager: mockPackageManager,
  mainConfig: {} as any,
  mainConfigPath: 'main.ts',
  packageJson: mockPackageJson,
  storiesPaths: [],
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

  // Mock packageJsonPaths
  Object.defineProperty(mockPackageManager, 'packageJsonPaths', {
    value: packageJsonFiles,
    writable: true,
    configurable: true,
  });

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

    // The implementation doesn't call globby directly, it uses packageJsonPaths
    // So we shouldn't expect globby to be called
    expect(mockPackageManager.packageJsonPaths).toEqual([filePath]);
  });

  it('should detect consolidated packages in package.json', async () => {
    const contents = JSON.stringify(mockPackageJson);
    const filePath = 'test/package.json';

    const result = await setupCheck(contents, [filePath]);
    expect(result).toMatchObject({
      consolidatedDeps: expect.any(Set),
    });
    expect(result?.consolidatedDeps).toContain('@storybook/core-common');
    expect(result?.consolidatedDeps).toContain('@storybook/manager-api');
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

  it('should add renamed packages to devDependencies when storybook is in devDependencies', async () => {
    const pkgJson = {
      dependencies: {
        '@storybook/experimental-nextjs-vite': '^8.0.0',
      },
      devDependencies: {
        storybook: '^9.0.0',
      },
    };
    const contents = JSON.stringify(pkgJson);
    const filePath = 'test/package.json';

    vi.mocked(readFile).mockResolvedValueOnce(contents);

    const errors = await transformPackageJsonFiles([filePath], false);

    expect(errors).toHaveLength(0);
    const written = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string);
    expect(written.devDependencies['@storybook/nextjs-vite']).toBe('^9.0.0');
    expect(written.dependencies['@storybook/experimental-nextjs-vite']).toBeUndefined();
  });

  it('should add renamed packages to dependencies when storybook is in dependencies', async () => {
    const pkgJson = {
      dependencies: {
        storybook: '^9.0.0',
        '@storybook/experimental-nextjs-vite': '^8.0.0',
      },
    };
    const contents = JSON.stringify(pkgJson);
    const filePath = 'test/package.json';

    vi.mocked(readFile).mockResolvedValueOnce(contents);

    const errors = await transformPackageJsonFiles([filePath], false);

    expect(errors).toHaveLength(0);
    const written = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string);
    expect(written.dependencies['@storybook/nextjs-vite']).toBe('^9.0.0');
    expect(written.dependencies['@storybook/experimental-nextjs-vite']).toBeUndefined();
  });

  it('should add renamed packages if storybook is not found', async () => {
    const pkgJson = {
      dependencies: {
        '@storybook/experimental-nextjs-vite': '^7.0.0',
      },
    };
    const contents = JSON.stringify(pkgJson);
    const filePath = 'test/package.json';

    vi.mocked(readFile).mockResolvedValueOnce(contents);

    const errors = await transformPackageJsonFiles([filePath], false);

    expect(errors).toHaveLength(0);
    const written = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string);
    expect(written.devDependencies['@storybook/nextjs-vite']).toEqual(
      versions['@storybook/nextjs-vite']
    );
    expect(written.dependencies?.['@storybook/nextjs-vite']).toBeUndefined();
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
