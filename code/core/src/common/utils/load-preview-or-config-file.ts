import { resolve } from 'node:path';

import { dedent } from 'ts-dedent';

import { getInterpretedFile } from './interpret-files';

export async function loadPreviewOrConfigFile({ configDir }: { configDir: string }) {
  const storybookConfigPath = await getInterpretedFile(resolve(configDir, 'config'));
  const storybookPreviewPath = await getInterpretedFile(resolve(configDir, 'preview'));

  if (storybookConfigPath && storybookPreviewPath) {
    throw new Error(dedent`
      You have both a "config.js" and a "preview.js", remove the "config.js" file from your configDir (${resolve(
        configDir,
        'config'
      )})`);
  }

  return storybookPreviewPath || storybookConfigPath;
}
