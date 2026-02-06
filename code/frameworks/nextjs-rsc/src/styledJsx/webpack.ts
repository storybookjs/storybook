import type { Configuration as WebpackConfig } from 'webpack';

import { addScopedAlias } from '../utils';

export const configureStyledJsx = (baseConfig: WebpackConfig): void => {
  addScopedAlias(baseConfig, 'styled-jsx');
};
