import { CoreBuilder } from 'storybook/internal/cli';

import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';

const generator: Generator = async (packageManager, npmOptions, options) => {
  await baseGenerator(
    packageManager,
    npmOptions,
    { ...options, builder: CoreBuilder.Vite },
    'svelte',
    {
      extensions: ['js', 'ts', 'svelte'],
      extraAddons: ['@storybook/addon-svelte-csf'],
    },
    'sveltekit'
  );
};

export default generator;
