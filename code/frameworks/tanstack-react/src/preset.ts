import { fileURLToPath } from 'node:url';

import type { StorybookConfigVite } from '@storybook/builder-vite';
import { viteFinal as reactViteFinal } from '@storybook/react-vite/preset';
import { dirname } from 'pathe';
import type { PresetProperty } from 'storybook/internal/types';
import { isCloudflareVitePlugin, isTanStackStartPlugin } from './plugins/incompatible-plugins.ts';
import { moduleInterceptionPlugin } from './plugins/module-interception.ts';
import { serverCodeEliminationPlugin } from './plugins/server-code-elimination.ts';
import { serverOnlyStubPlugin } from './plugins/server-only-stub.ts';

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
  '@tanstack/react-router > @tanstack/react-store',
  '@tanstack/react-router > @tanstack/react-store > use-sync-external-store/shim/with-selector',
];

export const viteFinal: StorybookConfigVite['viteFinal'] = async (config, options) => {
  const reactConfig = await reactViteFinal(config, options);

  const startMockPath = fileURLToPath(import.meta.resolve('./export-mocks/start.js'));
  const startStorageContextMockPath = fileURLToPath(
    import.meta.resolve('./export-mocks/start-storage-context.js')
  );
  const routerMockPath = fileURLToPath(
    import.meta.resolve('@storybook/tanstack-react/react-router')
  );
  const basePlugins = reactConfig.plugins ?? [];
  const plugins = [
    // Drop user plugins that are incompatible with Storybook — see ./plugins/incompatible-plugins.ts
    ...basePlugins.filter((p) => !isTanStackStartPlugin(p) && !isCloudflareVitePlugin(p)),
    serverCodeEliminationPlugin({ excludeFiles: [dirname(startMockPath)] }),
    serverOnlyStubPlugin(),
    moduleInterceptionPlugin({ startMockPath, startStorageContextMockPath, routerMockPath }),
  ];

  return {
    ...reactConfig,
    plugins,
  };
};
