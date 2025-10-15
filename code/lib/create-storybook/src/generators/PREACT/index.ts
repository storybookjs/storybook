import { CoreBuilder } from 'storybook/internal/cli';

import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';

const generator: Generator = async (packageManager, npmOptions, options) =>
  baseGenerator(packageManager, npmOptions, options, 'preact', {
    webpackCompiler: ({ builder }) => (builder === CoreBuilder.Webpack5 ? 'swc' : undefined),
  });

export default generator;
