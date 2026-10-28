import { getInterpretedFile, importModule } from '@storybook/core/internal/common';

import { resolve } from 'pathe';

const WEBPACK_CONFIGS = ['webpack.config', 'webpackfile'];

/** Load the first `webpack.config` or `webpackfile` in `configDir`, or `null` when there is none. */
export async function loadCustomWebpackConfig(configDir: string): Promise<unknown> {
  for (const name of WEBPACK_CONFIGS) {
    const file = getInterpretedFile(resolve(configDir, name));
    if (file) {
      return importModule(file);
    }
  }
  return null;
}
