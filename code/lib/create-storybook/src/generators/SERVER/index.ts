import { CoreBuilder } from 'storybook/internal/cli';

import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';

const generator: Generator = async (packageManager, npmOptions, options) => {
  await baseGenerator(
    packageManager,
    npmOptions,
    { ...options, builder: CoreBuilder.Webpack5 },
    'server',
    {
      webpackCompiler: () => 'swc',
      extensions: ['json', 'yaml', 'yml'],
    }
  );
};

export default generator;
