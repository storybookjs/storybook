import type { PresetProperty } from 'storybook/internal/types';

import {
  isReactBuilderDocgenPackageInstalled,
  prepareReactBuilderDocgen,
} from '@storybook/react/internal/builder-docgen';

import type { StorybookConfig } from './types.ts';

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/react/preset'),
};

/** Resolve from this package, which declares the builder docgen packages as optional peers. */
const resolve = (specifier: string) => import.meta.resolve(specifier);

export const viteFinal: NonNullable<StorybookConfig['viteFinal']> = async (config, options) => {
  const { presets } = options;
  const features = await presets.apply('features', {});

  if (features?.docgenServer) {
    // The docgen service extracts React metadata on the server. Keep the preview bundle free of
    // build-time `__docgenInfo` injection so custom argTypes remain docgen-free.
    return config;
  }

  const { reactDocgen: reactDocgenOption, reactDocgenTypescriptOptions } = await presets.apply<{
    reactDocgen?: 'react-docgen' | 'react-docgen-typescript' | false;
    reactDocgenTypescriptOptions?: Record<string, unknown>;
  }>('typescript', {});

  if (typeof reactDocgenOption !== 'string') {
    return config;
  }

  // Builder docgen packages are optional peers: import them only once builder docgen runs, so
  // projects on the docgen server never resolve them.
  const mode = await prepareReactBuilderDocgen({
    reactDocgen: reactDocgenOption,
    builder: 'vite',
    resolve,
    options,
  });
  if (!mode) {
    return config;
  }
  const useReactDocgenTypescript = mode === 'react-docgen-typescript';

  const plugins = [...(config?.plugins ?? [])];

  if (useReactDocgenTypescript) {
    plugins.push(
      (await import('@joshwooding/vite-plugin-react-docgen-typescript')).default({
        ...reactDocgenTypescriptOptions,
        // We *need* this set so that RDT returns default values in the same format as react-docgen
        savePropValueAsString: true,
      })
    );
  }

  // react-docgen reads every file, except TypeScript files when react-docgen-typescript reads them.
  // In react-docgen-typescript mode, react-docgen is optional and only covers JavaScript files.
  if (!useReactDocgenTypescript || isReactBuilderDocgenPackageInstalled(resolve, 'react-docgen')) {
    const { reactDocgen } = await import('./plugins/react-docgen.ts');
    // Needs to run before the react plugin, so add to the front
    plugins.unshift(
      await reactDocgen({
        include: useReactDocgenTypescript ? /\.(mjs|jsx?)$/ : /\.(mjs|tsx?|jsx?)$/,
      })
    );
  }

  return { ...config, plugins };
};
