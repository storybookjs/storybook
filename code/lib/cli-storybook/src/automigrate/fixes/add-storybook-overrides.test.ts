import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addStorybookOverrides } from './add-storybook-overrides';

// mock picocolors yellow and cyan
vi.mock('picocolors', () => {
  return {
    default: {
      yellow: (str: string) => str,
      cyan: (str: string) => str,
    },
  };
});

vi.mock('node:fs/promises');
vi.mock('globby', () => ({
  globby: vi.fn(),
}));
vi.mock('storybook/internal/common', () => ({
  getProjectRoot: () => '/test/project/root',
}));

const mockPackageJsonWithStorybook = {
  dependencies: {
    '@storybook/react': '^7.0.0',
    react: '^18.0.0',
  },
  devDependencies: {
    '@storybook/addon-essentials': '^7.0.0',
    typescript: '^5.0.0',
  },
};

const mockPackageJsonWithoutStorybook = {
  dependencies: {
    react: '^18.0.0',
  },
  devDependencies: {
    typescript: '^5.0.0',
  },
};

const setupGlobby = async (npmLockfiles: string[], packageJsonFiles: string[]) => {
  // eslint-disable-next-line depend/ban-dependencies
  const { globby } = await import('globby');
  const globbyMock = vi.mocked(globby);
  // Reset mock to ensure clean state
  globbyMock.mockReset();
  // Setup mock responses
  globbyMock
    .mockResolvedValueOnce(npmLockfiles) // First call for package-lock.json
    .mockResolvedValueOnce(packageJsonFiles); // Second call for package.json
};

const setupCheck = async (
  packageJsonContents: Record<string, any>,
  npmLockfiles: string[],
  packageJsonFiles: string[]
) => {
  vi.mocked(readFile).mockImplementation(async (path: any) => {
    const filePath = path.toString();
    const content = packageJsonContents[filePath];
    if (!content) {
      throw new Error(`No mock content for ${filePath}`);
    }
    return JSON.stringify(content);
  });
  await setupGlobby(npmLockfiles, packageJsonFiles);

  return addStorybookOverrides.check({} as any);
};

describe('check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null if no package-lock.json files are found', async () => {
    const result = await setupCheck(
      { '/test/project/root/package.json': mockPackageJsonWithoutStorybook },
      [],
      []
    );
    expect(result).toBeNull();
  });

  it('should return null if no package.json files with Storybook deps are found', async () => {
    const npmLockfiles = ['package-lock.json'];
    const packageJsonFiles = ['/test/project/root/package.json'];
    const packageJsonContents = {
      '/test/project/root/package.json': mockPackageJsonWithoutStorybook,
    };

    const result = await setupCheck(packageJsonContents, npmLockfiles, packageJsonFiles);
    expect(result).toBeNull();
  });

  it('should detect package.json files with Storybook deps when npm is used', async () => {
    const npmLockfiles = ['package-lock.json'];
    const packageJsonFiles = [
      '/test/project/root/package.json',
      '/test/project/root/packages/app/package.json',
    ];
    const packageJsonContents = {
      '/test/project/root/package.json': mockPackageJsonWithStorybook,
      '/test/project/root/packages/app/package.json': mockPackageJsonWithStorybook,
    };

    const result = await setupCheck(packageJsonContents, npmLockfiles, packageJsonFiles);
    expect(result).toMatchObject({
      packageJsonPaths: [
        '/test/project/root/package.json',
        '/test/project/root/packages/app/package.json',
      ],
    });
  });
});

describe('prompt', () => {
  it('should return a prompt with the detected package.json files', () => {
    const result = addStorybookOverrides.prompt({
      packageJsonPaths: ['/test/project/root/package.json'],
    });

    expect(result)
      .toMatchInlineSnapshot(`"We've detected that you're using npm and have Storybook dependencies in the following package.json files:
- /test/project/root/package.json

We'll add Storybook overrides to these package.json files to ensure consistent dependency resolution."`);
  });
});

describe('run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add overrides to package.json files', async () => {
    const packageJsonPath = '/test/project/root/package.json';
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(mockPackageJsonWithStorybook));

    await addStorybookOverrides.run?.({
      result: { packageJsonPaths: [packageJsonPath] },
      dryRun: false,
    } as any);

    expect(writeFile).toHaveBeenCalledWith(
      packageJsonPath,
      expect.stringContaining('"storybook": "^9.0.0"')
    );
  });

  it('should not modify files in dry run mode', async () => {
    const packageJsonPath = '/test/project/root/package.json';
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(mockPackageJsonWithStorybook));

    await addStorybookOverrides.run?.({
      result: { packageJsonPaths: [packageJsonPath] },
      dryRun: true,
    } as any);

    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should handle file read/write errors gracefully', async () => {
    const packageJsonPath = '/test/project/root/package.json';
    vi.mocked(readFile).mockRejectedValueOnce(new Error('Failed to read file'));

    await addStorybookOverrides.run?.({
      result: { packageJsonPaths: [packageJsonPath] },
      dryRun: false,
    } as any);

    expect(writeFile).not.toHaveBeenCalled();
  });
});
