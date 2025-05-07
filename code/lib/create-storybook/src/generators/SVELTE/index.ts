import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';

const generator: Generator = async (packageManager, npmOptions, options) => {
  await baseGenerator(packageManager, npmOptions, options, 'svelte', {
    extensions: ['js', 'ts', 'svelte'],
    extraAddons: ['@storybook/addon-svelte-csf'],
  });
};

export default generator;
