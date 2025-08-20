import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { dedent } from 'ts-dedent';

import { transformImportFiles } from './transform-imports';

const consolidatedPackages = {
  '@storybook/core-common': 'storybook/internal/common',
  '@storybook/theming': 'storybook/theming',
  '@storybook/components': 'storybook/internal/components',
  '@storybook/test': 'storybook/test',
} as const;

vi.mock('node:fs/promises');

describe('transformImportFiles', () => {
  it('should transform import declarations', async () => {
    const sourceContents = dedent`
      import { something } from '@storybook/components';
      import { other } from '@storybook/core-common';
    `;
    const sourceFiles = [join('src', 'test.ts')];

    vi.mocked(readFile).mockResolvedValueOnce(sourceContents);

    const errors = await transformImportFiles(sourceFiles, consolidatedPackages, false);

    expect(errors).toHaveLength(0);
    expect(writeFile).toHaveBeenCalledWith(
      sourceFiles[0],
      expect.stringContaining(`from 'storybook/internal/components'`)
    );
  });

  it('should transform not transformimport declarations matching a package partially', async () => {
    const sourceContents = dedent`
      import { a } from '@storybook/test-runner';
      import { b } from '@storybook/test';
    `;
    const sourceFiles = [join('src', 'test.ts')];

    vi.mocked(readFile).mockResolvedValueOnce(sourceContents);

    const errors = await transformImportFiles(sourceFiles, consolidatedPackages, false);

    expect(errors).toHaveLength(0);
    expect(writeFile).toHaveBeenCalledWith(
      sourceFiles[0],
      dedent`
      import { a } from '@storybook/test-runner';
      import { b } from 'storybook/test';
    `
    );
  });

  it('should transform import declarations with sub-paths', async () => {
    const sourceContents = dedent`
      import { other } from '@storybook/theming/create';
    `;
    const sourceFiles = [join('src', 'test.ts')];

    vi.mocked(readFile).mockResolvedValueOnce(sourceContents);

    const errors = await transformImportFiles(sourceFiles, consolidatedPackages, false);

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

    const errors = await transformImportFiles(sourceFiles, consolidatedPackages, false);

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

    const errors = await transformImportFiles(sourceFiles, consolidatedPackages, false);

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

    const errors = await transformImportFiles(sourceFiles, consolidatedPackages, false);

    expect(errors).toHaveLength(0);
    expect(writeFile).not.toHaveBeenCalledWith(sourceFiles[0], expect.any(String));
  });

  it('should not write files in dry run mode', async () => {
    const sourceContents = dedent`
      import { something } from '@storybook/components';
    `;
    const sourceFiles = [join('src', 'test.ts')];

    vi.mocked(readFile).mockResolvedValueOnce(sourceContents);

    const errors = await transformImportFiles(sourceFiles, consolidatedPackages, true);

    expect(errors).toHaveLength(0);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should handle file read errors', async () => {
    const sourceFiles = [join('src', 'test.ts')];
    vi.mocked(readFile).mockRejectedValueOnce(new Error('Failed to read file'));

    const errors = await transformImportFiles(sourceFiles, consolidatedPackages, true);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      file: sourceFiles[0],
      error: expect.any(Error),
    });
  });
});
