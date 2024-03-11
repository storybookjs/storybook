import { CoreBuilder } from '../../project_types';
import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';

const generator: Generator = async (packageManager, npmOptions, options) => {
  await baseGenerator(packageManager, npmOptions, options, 'react', {
    extraAddons: ['@storybook/addon-onboarding@^1.0.0'],
    useSWC: ({ builder }) => builder === CoreBuilder.Webpack5,
  });
};

export default generator;
