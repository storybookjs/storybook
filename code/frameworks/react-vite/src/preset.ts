import type { PresetProperty } from 'storybook/internal/types';

import type { ReactDocgenPlan } from '../../../renderers/react/src/docgen/engine.ts';
import type { StorybookConfig } from './types.ts';

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/react/preset'),
};

export const viteFinal: NonNullable<StorybookConfig['viteFinal']> = async (config, { presets }) => {
  const { builder } = await presets.apply<ReactDocgenPlan>('internal_reactDocgenPlan');

  if (!builder.reactDocgen && !builder.reactDocgenTypescript) {
    return config;
  }

  const plugins = [...(config?.plugins ?? [])];

  if (builder.reactDocgenTypescript) {
    const { reactDocgenTypescriptOptions } = await presets.apply<any>('typescript', {});
    plugins.push(
      (await import('@joshwooding/vite-plugin-react-docgen-typescript')).default({
        ...reactDocgenTypescriptOptions,
        // We *need* this set so that RDT returns default values in the same format as react-docgen
        savePropValueAsString: true,
      })
    );
  }

  if (builder.reactDocgen) {
    const { reactDocgen } = await import('./plugins/react-docgen.ts');
    // Needs to run before the react plugin, so add to the front
    plugins.unshift(
      await reactDocgen({
        include: builder.reactDocgen === 'all' ? /\.(mjs|tsx?|jsx?)$/ : /\.(mjs|jsx?)$/,
      })
    );
  }

  return { ...config, plugins };
};
