import { CoreBuilder } from 'storybook/internal/cli';

import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';

const generator: Generator = async (packageManager, npmOptions, options) => {
  await baseGenerator(packageManager, npmOptions, options, 'vue3', {
    extraAddons: [`@storybook/addon-onboarding`],
    extraPackages: async ({ builder }) => {
      return builder === CoreBuilder.Webpack5
        ? ['vue-loader@^17.0.0', '@vue/compiler-sfc@^3.2.0']
        : [];
    },
    webpackCompiler: ({ builder }) => (builder === CoreBuilder.Webpack5 ? 'swc' : undefined),
  });
};

export default generator;
