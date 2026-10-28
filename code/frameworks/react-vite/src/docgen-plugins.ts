import { deprecate } from '@storybook/core/internal/node-logger';
import type { StorybookConfigRaw } from '@storybook/core/internal/types';

import type { StorybookConfig } from './types.ts';

type ViteConfig = Parameters<NonNullable<StorybookConfig['viteFinal']>>[0];

/** Add the builder docgen plugins that `typescript.reactDocgen` selects when server docgen is off. */
export async function withReactDocgen(
  config: ViteConfig,
  {
    features,
    typescript,
  }: {
    features: StorybookConfigRaw['features'];
    typescript: StorybookConfig['typescript'];
  }
): Promise<ViteConfig> {
  if (features?.docgenServer) {
    // The docgen service extracts React metadata on the server. Keep the preview bundle free of
    // build-time `__docgenInfo` injection so custom argTypes remain docgen-free.
    return config;
  }

  const plugins = [...(config?.plugins ?? [])];

  // Add docgen plugin
  const { reactDocgen: reactDocgenOption, reactDocgenTypescriptOptions } = typescript ?? {};
  let typescriptPresent;

  try {
    import.meta.resolve('typescript');
    typescriptPresent = true;
  } catch {
    typescriptPresent = false;
  }

  if (typeof reactDocgenOption === 'string') {
    deprecate(
      `Builder docgen (\`typescript.reactDocgen: '${reactDocgenOption}'\`) is deprecated and will be removed in Storybook 12. ` +
        `It runs because \`features.docgenServer\` is off. Server-side docgen needs the \`typescript\` package: install it and remove any \`docgenServer: false\` from your \`.storybook/main.ts\`.`
    );
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
    const { reactDocgen } = await import('./plugins/react-docgen.ts');
    // Needs to run before the react plugin, so add to the front
    plugins.unshift(
      // If react-docgen is specified, use it for everything, otherwise only use it for non-typescript files
      await reactDocgen({
        include: reactDocgenOption === 'react-docgen' ? /\.(mjs|tsx?|jsx?)$/ : /\.(mjs|jsx?)$/,
      })
    );
  }

  return { ...config, plugins };
}
