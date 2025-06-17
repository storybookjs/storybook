import path from 'node:path';

import type { PresetConfig } from 'storybook/internal/types';

import { importPreset, resolvePreset } from './preset-module-loader';
import { validateConfigurationFiles } from './validate-configuration-files';

export async function loadCustomPresets({
  configDir,
}: {
  configDir: string;
}): Promise<PresetConfig[]> {
  validateConfigurationFiles(configDir);

  const mainPath = await resolvePreset(path.resolve(configDir, 'main'));
  const main = (await importPreset(mainPath)) as PresetConfig;

  if (main) {
    const resolved = await resolvePreset(path.resolve(configDir, 'main'));
    if (resolved) {
      return [resolved];
    }
  }
  return [];
}
