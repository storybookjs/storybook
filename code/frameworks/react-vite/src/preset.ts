import {
  getTypeScriptForDocgenError,
  isDocgenServerDisabledInMainConfig,
} from 'storybook/internal/common';
import { deprecate } from 'storybook/internal/node-logger';
import type { PresetProperty } from 'storybook/internal/types';

import type { StorybookConfig } from './types.ts';

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/react/preset'),
};

export const viteFinal: NonNullable<StorybookConfig['viteFinal']> = async (config, options) => {
  const { presets } = options;
  const features = await presets.apply('features', {});

  if (features?.docgenServer) {
    // The docgen service extracts React metadata on the server. Keep the preview bundle free of
    // build-time `__docgenInfo` injection so custom argTypes remain docgen-free.
    return config;
  }

  const plugins = [...(config?.plugins ?? [])];

  // Add docgen plugin
  const { reactDocgen: reactDocgenOption, reactDocgenTypescriptOptions } = await presets.apply<any>(
    'typescript',
    {}
  );
  const typescriptUsable = !getTypeScriptForDocgenError((specifier) =>
    import.meta.resolve(specifier)
  );

  if (
    typeof reactDocgenOption === 'string' &&
    (await isDocgenServerDisabledInMainConfig(options))
  ) {
    deprecate(
      `Builder docgen (\`typescript.reactDocgen: '${reactDocgenOption}'\`) is deprecated and will be removed in Storybook 12. ` +
        `It runs because your Storybook main config sets \`features.docgenServer: false\`. Remove that setting to use server-side docgen.`
    );
  }

  const useReactDocgenTypescript =
    reactDocgenOption === 'react-docgen-typescript' && typescriptUsable;

  if (useReactDocgenTypescript) {
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
    const { reactDocgen } = await import('./plugins/react-docgen.ts');
    // Needs to run before the react plugin, so add to the front
    plugins.unshift(
      // react-docgen reads every file, except TypeScript files when react-docgen-typescript reads them
      await reactDocgen({
        include: useReactDocgenTypescript ? /\.(mjs|jsx?)$/ : /\.(mjs|tsx?|jsx?)$/,
      })
    );
  }

  return { ...config, plugins };
};
