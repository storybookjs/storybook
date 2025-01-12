import { CoreBuilder } from 'storybook/internal/cli';

import { getAddonSvelteCsfVersion } from '../SVELTE';
import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';

const generator: Generator = async (packageManager, npmOptions, options) => {
  const addonSvelteCsfVersion = await getAddonSvelteCsfVersion(packageManager);

  await baseGenerator(
    packageManager,
    npmOptions,
    { ...options, builder: CoreBuilder.Vite },
    'svelte',
    {
      extensions: ['js', 'ts', 'svelte'],
      extraAddons: [
        `@storybook/addon-svelte-csf${addonSvelteCsfVersion && `@${addonSvelteCsfVersion}`}`,
      ],
    },
    'sveltekit'
  );
};

export default generator;
