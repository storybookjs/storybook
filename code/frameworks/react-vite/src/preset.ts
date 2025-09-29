import type { PresetProperty } from 'storybook/internal/types';

import type { StorybookConfig } from './types';

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/react/preset'),
};

export const viteFinal: NonNullable<StorybookConfig['viteFinal']> = async (config, { presets }) => {
  const plugins = [...(config?.plugins ?? [])];

  // Add docgen plugin
  const { reactDocgen: reactDocgenOption, reactDocgenTypescriptOptions } = await presets.apply<any>(
    'typescript',
    {}
  );
  let typescriptPresent;

  try {
    import.meta.resolve('typescript');
    typescriptPresent = true;
  } catch (e) {
    typescriptPresent = false;
  }

  if (reactDocgenOption === 'react-docgen-typescript' && typescriptPresent) {
    plugins.push(
      (await import('@joshwooding/vite-plugin-react-docgen-typescript')).default({
        ...reactDocgenTypescriptOptions,
        // We *need* this set so that RDT returns default values in the same format as react-docgen
        savePropValueAsString: true,
      })
    );
  }

  // Add react-docgen so long as the option is not false
  if (typeof reactDocgenOption === 'string') {
    const { reactDocgen } = await import('./plugins/react-docgen');
    // Needs to run before the react plugin, so add to the front
    plugins.unshift(
      // If react-docgen is specified, use it for everything, otherwise only use it for non-typescript files
      await reactDocgen({
        include: reactDocgenOption === 'react-docgen' ? /\.(mjs|tsx?|jsx?)$/ : /\.(mjs|jsx?)$/,
      })
    );
  }

  return { ...config, plugins };
};
