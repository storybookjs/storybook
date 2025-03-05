import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import type { Fix, RunOptions } from '../types';
import { type ConsolidatedImportsOptions, consolidatedImports } from './consolidated-imports';

vi.mock('node:fs/promises');
vi.mock('globby', () => ({
  globby: vi.fn(),
}));

const mockPackageJson = {
  dependencies: {},
  devDependencies: {},
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

const setupCheck = async (contents: string, files: string[]) => {
  vi.mocked(readFile).mockResolvedValue(contents);
  await setupGlobby(files);

  return consolidatedImports.check({
    ...mockRunOptions,
    storybookVersion: '8.0.0',
  });
};

const runWithError = async (result: ConsolidatedImportsOptions) => {
  return (
    consolidatedImports as Fix<ConsolidatedImportsOptions> & {
      run: (options: RunOptions<ConsolidatedImportsOptions>) => Promise<void>;
    }
  ).run({
    result,
    dryRun: false,
    ...mockRunOptions,
  });
};

describe('check', () => {
  it('should call globby with correct patterns', async () => {
    const filePath = join('src', 'test.ts');
    const contents = `import { something } from '@storybook/components';`;

    await setupCheck(contents, [filePath]);

    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    expect(globby).toHaveBeenCalledWith(
      ['**/*.{js,jsx,ts,tsx}'],
      expect.objectContaining({
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
      })
    );
  });

  it('should detect consolidated package imports', async () => {
    const contents = `
      import { something } from '@storybook/components';
      import { other } from '@storybook/core-common';
    `;
    const filePath = join('src', 'test.ts');

    const result = await setupCheck(contents, [filePath]);
    expect(result).toMatchObject({
      files: [filePath],
    });
  });

  it('should not detect non-consolidated package imports', async () => {
    const contents = `
      import { something } from '@storybook/other-package';
      import { other } from 'some-other-package';
    `;
    const filePath = join('src', 'test.ts');

    const result = await setupCheck(contents, [filePath]);
    expect(result).toBeNull();
  });
});

describe('run-with-success', () => {
  const run = async ({ contents, filePath }: { contents: string; filePath: string }) => {
    vi.mocked(readFile).mockResolvedValue(contents);
    await setupGlobby([filePath]);

    const result = await consolidatedImports.check({
      ...mockRunOptions,
      storybookVersion: '8.0.0',
    });

    if (!result) {
      throw new Error('No result from check');
    }

    await (
      consolidatedImports as Fix<ConsolidatedImportsOptions> & {
        run: (options: RunOptions<ConsolidatedImportsOptions>) => Promise<void>;
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

  it('should transform import declarations', async () => {
    const contents = dedent`
      import { something } from '@storybook/components';
      import { other } from '@storybook/core-common';
    `;
    const filePath = join('src', 'test.ts');

    const transformed = await run({ contents, filePath });
    expect(transformed).toMatchInlineSnapshot(`
      "import { something } from "storybook/internal/components";
      import { other } from "storybook/internal/common";"
    `);
  });

  it('should transform require calls', async () => {
    const contents = dedent`
      const something = require('@storybook/components');
      const other = require('@storybook/core-common');
    `;
    const filePath = join('src', 'test.ts');

    const transformed = await run({ contents, filePath });
    expect(transformed).toMatchInlineSnapshot(`
      "const something = require("storybook/internal/components");
      const other = require("storybook/internal/common");"
    `);
  });

  it('should handle mixed import styles', async () => {
    const contents = dedent`
      import { something } from '@storybook/components';
      const other = require('@storybook/core-common');
    `;
    const filePath = join('src', 'test.ts');

    const transformed = await run({ contents, filePath });
    expect(transformed).toMatchInlineSnapshot(`
      "import { something } from "storybook/internal/components";
      const other = require("storybook/internal/common");"
    `);
  });

  it('should not transform non-consolidated package imports', async () => {
    const contents = `
      import { something } from '@storybook/other-package';
      const other = require('some-other-package');
    `;
    const filePath = join('src', 'test.ts');

    const result = await setupCheck(contents, [filePath]);
    expect(result).toBeNull();
  });
});

describe('run-with-failure', () => {
  it('should handle file read errors', async () => {
    const filePath = join('src', 'test.ts');
    const contents = `import { something } from '@storybook/components';`;

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
    const contents = `import { something } from '@storybook/components';`;
    const filePath = join('src', 'test.ts');
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
    const file1 = join('src', 'test1.ts');
    const file2 = join('src', 'test2.ts');
    const contents = `import { something } from '@storybook/components';`;

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
