import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';
import { dirname } from 'pathe';
import type { StorybookConfigVite } from '@storybook/builder-vite';
import { viteFinal as reactViteFinal } from '@storybook/react-vite/preset';
import { serverCodeEliminationPlugin } from './plugins/server-code-elimination.ts';
import { serverOnlyStubPlugin } from './plugins/server-only-stub.ts';
import { moduleInterceptionPlugin } from './plugins/module-interception.ts';

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: fileURLToPath(import.meta.resolve('@storybook/builder-vite')),
      options: typeof framework === 'string' ? {} : framework.options.builder || {},
    },
    renderer: fileURLToPath(import.meta.resolve('@storybook/react/preset')),
  };
};

export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entry = []) => [
  ...entry,
  fileURLToPath(import.meta.resolve('@storybook/tanstack-react/preview')),
];

export const optimizeViteDeps = [
  '@tanstack/react-store',
  '@tanstack/react-router > @tanstack/react-store',
  'use-sync-external-store/shim/with-selector',
];

export const viteFinal: StorybookConfigVite['viteFinal'] = async (config, options) => {
  const reactConfig = await reactViteFinal(config, options);

  /**
   * A custom viteFinal implementation that removes any TanStack Start Vite plugins from the user's
   * Vite config, as a workaround for compatibility issues.
   *
   * This follows the pattern discussed at: https://github.com/storybookjs/storybook/issues/33754
   */
  const isTanStackStartPlugin = (p: unknown): boolean => {
    if (Array.isArray(p)) {
      return p.some(isTanStackStartPlugin);
    }
    const pluginRecord = p as Record<string, unknown>;
    return (
      typeof p === 'object' &&
      p !== null &&
      'name' in pluginRecord &&
      typeof pluginRecord.name === 'string' &&
      (pluginRecord.name.startsWith('tanstack-start') || pluginRecord.name.includes('rsc:'))
    );
  };

  const startMockPath = fileURLToPath(import.meta.resolve('./export-mocks/start.js'));
  const startStorageContextMockPath = fileURLToPath(
    import.meta.resolve('./export-mocks/start-storage-context.js')
  );
  const routerMockPath = fileURLToPath(
    import.meta.resolve('@storybook/tanstack-react/react-router')
  );
  const basePlugins = reactConfig.plugins ?? [];
  const plugins = [
    ...basePlugins.filter((p) => !isTanStackStartPlugin(p)),
    serverCodeEliminationPlugin({ excludeFiles: [dirname(startMockPath)] }),
    serverOnlyStubPlugin(),
    moduleInterceptionPlugin({ startMockPath, startStorageContextMockPath, routerMockPath }),
  ];

  return {
    ...reactConfig,
    plugins,
  };
};
