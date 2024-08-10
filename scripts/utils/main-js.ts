import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import slash from 'slash';

import { getInterpretedFile } from '../../code/core/src/common';
import type { ConfigFile } from '../../code/core/src/csf-tools';
import { readConfig } from '../../code/core/src/csf-tools';

export async function readMainConfig({ cwd }: { cwd: string }) {
  const configDir = join(cwd, '.storybook');
  if (!existsSync(configDir)) {
    throw new Error(
      `Unable to find the Storybook folder in "${configDir}". Are you sure it exists? Or maybe this folder uses a custom Storybook config directory?`
    );
  }

  const mainConfigPath = await getInterpretedFile(resolve(configDir, 'main'));
  return readConfig(mainConfigPath);
}

export function addPreviewAnnotations(mainConfig: ConfigFile, paths: string[]) {
  const config = mainConfig.getFieldValue(['previewAnnotations']) as string[];
  mainConfig.setFieldValue(['previewAnnotations'], [...(config || []), ...paths.map(slash)]);
}
