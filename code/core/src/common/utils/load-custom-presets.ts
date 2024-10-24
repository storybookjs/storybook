import { extname, resolve } from 'node:path';

import type { PresetConfig } from '@storybook/core/types';

import { interopImport, serverResolve } from './interpret-require';
import { validateConfigurationFiles } from './validate-configuration-files';

export async function loadCustomPresets({
  configDir,
}: {
  configDir: string;
}): Promise<PresetConfig[]> {
  await validateConfigurationFiles(configDir);

  // const presetsPath = resolve(configDir, 'presets');
  const mainPath = serverResolve(resolve(configDir, 'main'));

  // const presets = extname(presetsPath) ? await interopImport(presetsPath) : undefined;
  const main = mainPath && extname(mainPath) ? await interopImport(mainPath) : undefined;

  // console.log({main})

  if (main) {
    const resolved = serverResolve(resolve(configDir, 'main'));
    if (resolved) {
      return [resolved];
    }
  }

  return [];
  // return presets || [];
}
