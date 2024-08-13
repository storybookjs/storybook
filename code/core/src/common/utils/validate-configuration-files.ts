import { resolve } from 'node:path';

import { once } from '@storybook/core/node-logger';
import { MainFileMissingError } from '@storybook/core/server-errors';

import { glob } from 'glob';
import slash from 'slash';
import { dedent } from 'ts-dedent';

import { boost } from './interpret-files';

export async function validateConfigurationFiles(configDir: string) {
  const extensionsPattern = `{${Array.from(boost).join(',')}}`;
  const mainConfigMatches = await glob(slash(resolve(configDir, `main${extensionsPattern}`)));

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
