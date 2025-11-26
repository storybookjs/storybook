import { resolve } from 'node:path';

import { once } from 'storybook/internal/node-logger';
import { MainFileMissingError } from 'storybook/internal/server-errors';

// eslint-disable-next-line depend/ban-dependencies
import { glob } from 'glob';
// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';
import { dedent } from 'ts-dedent';

import { supportedExtensions } from './interpret-files';

export async function validateConfigurationFiles(configDir: string, cwd?: string) {
  const extensionsPattern = `{${Array.from(supportedExtensions).join(',')}}`;
  const mainConfigMatches = await glob(slash(resolve(configDir, `main${extensionsPattern}`)), {
    cwd: cwd ?? process.cwd(),
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
