import path from 'node:path';

import type { PresetConfig } from '@storybook/core/types';

import { serverRequire, serverResolve } from './interpret-require';
import { validateConfigurationFiles } from './validate-configuration-files';

export function loadCustomPresets({ configDir }: { configDir: string }): PresetConfig[] {
  validateConfigurationFiles(configDir);

  const presets = serverRequire(path.resolve(configDir, 'presets'));
  const main = serverRequire(path.resolve(configDir, 'main'));

  if (main) {
    const resolved = serverResolve(path.resolve(configDir, 'main'));
    if (resolved) {
      return [resolved];
    }
  }

  return presets || [];
}
