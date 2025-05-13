import { resolve } from 'node:path';

import { serverRequire } from 'storybook/internal/common';

const webpackConfigs = ['webpack.config', 'webpackfile'];

export const loadCustomWebpackConfig = (configDir: string) =>
  serverRequire(webpackConfigs.map((configName) => resolve(configDir, configName)));
