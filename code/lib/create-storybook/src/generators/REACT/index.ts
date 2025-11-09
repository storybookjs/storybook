import { CoreBuilder, SupportedLanguage, detectLanguage } from 'storybook/internal/cli';

import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';

const generator: Generator = async (packageManager, npmOptions, options) => {
  // Add prop-types dependency if not using TypeScript
  const language = await detectLanguage(packageManager as any);
  const extraPackages = language === SupportedLanguage.JAVASCRIPT ? ['prop-types'] : [];

  await baseGenerator(packageManager, npmOptions, options, 'react', {
    extraPackages,
    webpackCompiler: ({ builder }) => (builder === CoreBuilder.Webpack5 ? 'swc' : undefined),
  });
};

export default generator;
