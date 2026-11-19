import { parseJsonText } from 'storybook/internal/cli';
import { getProjectRoot } from 'storybook/internal/common';

import type { FixFiles } from '../fix-files.ts';

/** `null` when the file cannot be read or is not valid JSON with comments. */
export const readJsonFile = async (
  files: Pick<FixFiles, 'read'>,
  path: string
): Promise<any | null> => {
  try {
    return parseJsonText(await files.read(path));
  } catch {
    return null;
  }
};

export const findWorkspaceFiles = async (basename: string): Promise<string[]> => {
  // eslint-disable-next-line depend/ban-dependencies
  const { globby } = await import('globby');
  return globby([`**/${basename}`], {
    cwd: getProjectRoot(),
    ignore: ['**/node_modules/**', '**/dist/**', '**/storybook-static/**'],
    absolute: true,
  });
};
