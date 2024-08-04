import path from 'node:path';
import { logger } from '@storybook/core/node-logger';
import { dedent } from 'ts-dedent';

import { getInterpretedFile } from './interpret-files';

export async function loadManagerOrAddonsFile({ configDir }: { configDir: string }) {
  const storybookCustomAddonsPath = await getInterpretedFile(path.resolve(configDir, 'addons'));
  const storybookCustomManagerPath = await getInterpretedFile(path.resolve(configDir, 'manager'));

  if (storybookCustomAddonsPath || storybookCustomManagerPath) {
    logger.info('=> Loading custom manager config');
  }

  if (storybookCustomAddonsPath && storybookCustomManagerPath) {
    throw new Error(dedent`
      You have both a "addons.js" and a "manager.js", remove the "addons.js" file from your configDir (${path.resolve(
        configDir,
        'addons'
      )})`);
  }

  return storybookCustomManagerPath || storybookCustomAddonsPath;
}
