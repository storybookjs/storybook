import { detectLanguage } from '../../detect';
import { CoreBuilder, SupportedLanguage } from '../../project_types';
import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';

const generator: Generator = async (packageManager, npmOptions, options) => {
  // Add prop-types dependency if not using TypeScript
  const language = await detectLanguage(packageManager);
  const extraPackages = language === SupportedLanguage.JAVASCRIPT ? ['prop-types'] : [];

  await baseGenerator(packageManager, npmOptions, options, 'react', {
    extraPackages,
    useSWC: ({ builder }) => builder === CoreBuilder.Webpack5,
    extraAddons: ['@storybook/addon-onboarding@^1.0.0'],
  });
};

export default generator;
