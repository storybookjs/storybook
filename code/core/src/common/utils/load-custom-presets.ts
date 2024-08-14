import { resolve } from 'node:path';

import type { PresetConfig } from '@storybook/core/types';

import { serverRequire, serverResolve } from './interpret-require';
import { validateConfigurationFiles } from './validate-configuration-files';

export function loadCustomPresets({ configDir }: { configDir: string }): PresetConfig[] {
  validateConfigurationFiles(configDir);

  const presets = serverRequire(resolve(configDir, 'presets'));
  const main = serverRequire(resolve(configDir, 'main'));

  if (main) {
    const resolved = serverResolve(resolve(configDir, 'main'));
    if (resolved) {
      return [resolved];
    }
  }

  return presets || [];
}
