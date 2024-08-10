import path from 'node:path';

import { serverRequire } from 'storybook/internal/common';

const webpackConfigs = ['webpack.config', 'webpackfile'];

export const loadCustomWebpackConfig = (configDir: string) =>
  serverRequire(webpackConfigs.map((configName) => path.resolve(configDir, configName)));
