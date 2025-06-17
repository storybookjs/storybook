import path from 'node:path';

import { importPreset, resolveModule } from '../../../core/src/common/utils/preset-module-loader';

const webpackConfigs = ['webpack.config', 'webpackfile'];

export const loadCustomWebpackConfig = async (configDir: string) => {
  const resolvedConfigPaths = (
    await Promise.all(
      webpackConfigs
        .map((configName) => path.resolve(configDir, configName))
        .map(async (configPath) => await resolveModule(configPath))
    )
  ).filter(Boolean);
  if (resolvedConfigPaths.length === 0) {
    return undefined;
  }
  return await importPreset(resolvedConfigPaths[0] as string);
};
