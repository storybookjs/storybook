import { resolve } from 'node:path';

import { once } from 'storybook/internal/node-logger';
import { MainFileMissingError } from 'storybook/internal/server-errors';

import { glob } from 'tinyglobby';
import { dedent } from 'ts-dedent';

import { globCaseSensitiveMatch } from './common-glob-options.ts';
import { supportedExtensions } from './interpret-files.ts';

export async function validateConfigurationFiles(configDir: string, _cwd?: string) {
  const extensionsPattern = `{${Array.from(supportedExtensions).join(',')}}`;
  const mainConfigMatches = await glob(`main${extensionsPattern}`, {
    cwd: resolve(configDir),
    caseSensitiveMatch: globCaseSensitiveMatch,
    expandDirectories: false,
  });

  const [mainConfigPath] = mainConfigMatches;

  if (mainConfigMatches.length > 1) {
    once.warn(dedent`
      Multiple main files found in your configDir (${resolve(configDir)}).
      Storybook will use the first one found and ignore the others. Please remove the extra files.
    `);
  }

  if (!mainConfigPath) {
    throw new MainFileMissingError({ location: configDir });
  }
}
