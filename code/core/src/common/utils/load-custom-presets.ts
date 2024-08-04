import path from 'node:path';
import { serverRequire, serverResolve } from './interpret-require';
import { validateConfigurationFiles } from './validate-configuration-files';
import type { PresetConfig } from '@storybook/core/types';

export async function loadCustomPresets({
  configDir,
}: {
  configDir: string;
}): Promise<PresetConfig[]> {
  validateConfigurationFiles(configDir);

  const presets = await serverRequire(path.resolve(configDir, 'presets'));
  const main = await serverRequire(path.resolve(configDir, 'main'));

  if (main) {
    const resolved = await serverResolve(path.resolve(configDir, 'main'));
    if (resolved) {
      return [resolved];
    }
  }

  return presets || [];
}
