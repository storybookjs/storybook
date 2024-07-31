import { dedent } from 'ts-dedent';
import { glob } from 'glob';
import path from 'node:path';
import slash from 'slash';
import { once } from '@storybook/core/node-logger';

import { boost } from './interpret-files';
import { MainFileMissingError } from '@storybook/core/server-errors';

export async function validateConfigurationFiles(configDir: string) {
  const extensionsPattern = `{${Array.from(boost).join(',')}}`;
  const mainConfigMatches = await glob(slash(path.resolve(configDir, `main${extensionsPattern}`)));

  const [mainConfigPath] = mainConfigMatches;

  if (mainConfigMatches.length > 1) {
    once.warn(dedent`
      Multiple main files found in your configDir (${path.resolve(configDir)}).
      Storybook will use the first one found and ignore the others. Please remove the extra files.
    `);
  }

  if (!mainConfigPath) {
    throw new MainFileMissingError({ location: configDir });
  }
}
