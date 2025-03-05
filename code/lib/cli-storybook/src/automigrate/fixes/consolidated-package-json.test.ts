import { readFile, writeFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import type { Fix, RunOptions } from '../types';
import {
  type ConsolidatedPackageJsonOptions,
  consolidatedPackageJson,
} from './consolidated-package-json';

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
  vi.mocked(globby).mockResolvedValue(files);
};

const setupCheck = async (
  contents: string,
  files: string[]
): Promise<ConsolidatedPackageJsonOptions | null> => {
  vi.mocked(readFile).mockResolvedValue(contents);
  await setupGlobby(files);

  return consolidatedPackageJson.check({
    ...mockRunOptions,
    storybookVersion: '8.0.0',
  });
};

const runWithError = async (result: ConsolidatedPackageJsonOptions) => {
  return (
    consolidatedPackageJson as Fix<ConsolidatedPackageJsonOptions> & {
      run: (options: RunOptions<ConsolidatedPackageJsonOptions>) => Promise<void>;
    }
  ).run({
    result,
    dryRun: false,
    ...mockRunOptions,
  });
};

describe('check', () => {
  it('should call globby with correct patterns', async () => {
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

  it('should detect consolidated packages', async () => {
    const contents = JSON.stringify(mockPackageJson);
    const filePath = 'test/package.json';

    const result = await setupCheck(contents, [filePath]);
    expect(result).toMatchObject({
      files: [filePath],
    });
  });

  it('should not detect non-consolidated packages', async () => {
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

describe('run-with-success', () => {
  const run = async ({ contents, filePath }: { contents: string; filePath: string }) => {
    vi.mocked(readFile).mockResolvedValue(contents);
    await setupGlobby([filePath]);

    const result = await consolidatedPackageJson.check({
      ...mockRunOptions,
      storybookVersion: '8.0.0',
    });

    if (!result) {
      throw new Error('No result from check');
    }

    await (
      consolidatedPackageJson as Fix<ConsolidatedPackageJsonOptions> & {
        run: (options: RunOptions<ConsolidatedPackageJsonOptions>) => Promise<void>;
      }
    ).run({
      result,
      dryRun: false,
      ...mockRunOptions,
    });

    const writeFileMock = vi.mocked(writeFile);
    if (!writeFileMock.mock.calls.length) {
      throw new Error('writeFile was not called');
    }
    return writeFileMock.mock.calls[0][1];
  };

  it('should remove consolidated packages and add storybook to devDependencies', async () => {
    const contents = JSON.stringify(mockPackageJson);
    const filePath = 'test/package.json';

    const transformed = await run({ contents, filePath });
    expect(transformed).toMatchInlineSnapshot(`
      "{
        "dependencies": {
          "@storybook/react": "^7.0.0",
          "react": "^18.0.0"
        },
        "devDependencies": {
          "@storybook/addon-essentials": "^7.0.0",
          "typescript": "^5.0.0",
          "storybook": "^8.0.0"
        }
      }"
    `);
  });

  it('should not write files in dry run mode', async () => {
    const contents = JSON.stringify(mockPackageJson);
    const filePath = 'test/package.json';

    const result = await consolidatedPackageJson.check({
      ...mockRunOptions,
      storybookVersion: '8.0.0',
    });

    if (!result) {
      throw new Error('No result from check');
    }

    await (
      consolidatedPackageJson as Fix<ConsolidatedPackageJsonOptions> & {
        run: (options: RunOptions<ConsolidatedPackageJsonOptions>) => Promise<void>;
      }
    ).run({
      result,
      dryRun: true,
      ...mockRunOptions,
    });

    expect(writeFile).not.toHaveBeenCalled();
  });
});

describe('run-with-failure', () => {
  it('should handle file read errors', async () => {
    const filePath = 'test/package.json';
    const contents = JSON.stringify(mockPackageJson);

    const result = await setupCheck(contents, [filePath]);
    if (!result) {
      throw new Error('No result from check');
    }

    vi.mocked(readFile).mockRejectedValue(new Error('Failed to read file'));

    await expect(runWithError(result)).rejects.toThrow(
      `Failed to process 1 files:\n- ${filePath}: Failed to read file`
    );
  });

  it('should handle file write errors', async () => {
    const contents = JSON.stringify(mockPackageJson);
    const filePath = 'test/package.json';
    vi.mocked(writeFile).mockRejectedValueOnce(new Error('Failed to write file'));

    const result = await setupCheck(contents, [filePath]);
    if (!result) {
      throw new Error('No result from check');
    }

    await expect(runWithError(result)).rejects.toThrow(
      `Failed to process 1 files:\n- ${filePath}: Failed to write file`
    );
  });

  it('should handle multiple file errors', async () => {
    const file1 = 'test1/package.json';
    const file2 = 'test2/package.json';
    const contents = JSON.stringify(mockPackageJson);

    const result = await setupCheck(contents, [file1, file2]);
    if (!result) {
      throw new Error('No result from check');
    }

    vi.mocked(readFile).mockRejectedValue(new Error('Failed to read file'));

    await expect(runWithError(result)).rejects.toThrow(
      `Failed to process 2 files:\n- ${file1}: Failed to read file\n- ${file2}: Failed to read file`
    );
  });
});
