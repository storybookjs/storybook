import { fileURLToPath } from 'node:url';

import type { StorybookConfigVite } from '@storybook/builder-vite';
import { dirname } from 'pathe';

import { isCloudflareVitePlugin, isTanStackStartPlugin } from './plugins/incompatible-plugins.ts';
import { moduleInterceptionPlugin } from './plugins/module-interception.ts';
import { serverCodeEliminationPlugin } from './plugins/server-code-elimination.ts';
import { serverOnlyStubPlugin } from './plugins/server-only-stub.ts';

export const OPTIMIZE_VITE_DEPS = [
  '@tanstack/react-router > @tanstack/react-store',
  '@tanstack/react-router > @tanstack/react-store > use-sync-external-store/shim/with-selector',
];

type ViteConfig = Parameters<NonNullable<StorybookConfigVite['viteFinal']>>[0];

/** List the preview annotation files this framework adds after the renderer's. */
export function getPreviewAnnotations(): string[] {
  return [fileURLToPath(import.meta.resolve('@storybook/tanstack-react/preview'))];
}

/** Add the TanStack mocks and server-code plugins to a config that already has the React plugins. */
export function withTanStack(config: ViteConfig): ViteConfig {
  // Resolve through the package exports: this module is bundled into a shared chunk.
  const startMockPath = fileURLToPath(import.meta.resolve('@storybook/tanstack-react/start'));
  const startStorageContextMockPath = fileURLToPath(
    import.meta.resolve('@storybook/tanstack-react/start-storage-context')
  );
  const routerMockPath = fileURLToPath(
    import.meta.resolve('@storybook/tanstack-react/react-router')
  );
  const basePlugins = config.plugins ?? [];
  const plugins = [
    // Drop user plugins that are incompatible with Storybook — see ./plugins/incompatible-plugins.ts
    ...basePlugins.filter((p) => !isTanStackStartPlugin(p) && !isCloudflareVitePlugin(p)),
    serverCodeEliminationPlugin({ excludeFiles: [dirname(startMockPath)] }),
    serverOnlyStubPlugin(),
    moduleInterceptionPlugin({ startMockPath, startStorageContextMockPath, routerMockPath }),
  ];

  return {
    ...config,
    plugins,
  };
}
