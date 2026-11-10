import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { MainFileMissingError } from 'storybook/internal/server-errors';

import { validateConfigurationFiles } from '../validate-configuration-files.ts';

vi.mock('storybook/internal/node-logger');

const projectDir = join(__dirname, '__mockdata__', '[project] {a,b}');

describe('validateConfigurationFiles', () => {
  it('finds the main config in a directory whose path contains glob characters', async () => {
    await expect(
      validateConfigurationFiles(join(projectDir, '.storybook'))
    ).resolves.toBeUndefined();
  });

  it('throws when the directory has no main config', async () => {
    await expect(validateConfigurationFiles(join(projectDir, 'empty'))).rejects.toThrow(
      MainFileMissingError
    );
  });
});
