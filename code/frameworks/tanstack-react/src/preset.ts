import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';
import { dirname } from 'pathe';
import type { StorybookConfigVite } from '@storybook/builder-vite';
import { viteFinal as reactViteFinal } from '@storybook/react-vite/preset';
import { serverCodeEliminationPlugin } from './plugins/server-code-elimination.ts';
import { serverOnlyStubPlugin } from './plugins/server-only-stub.ts';

const INTERCEPTED_PATTERNS = ['virtual:cloudflare', 'server-entry', 'worker-entry'];
const INTERCEPTED_MODULES = ['@tanstack/react-start'];
const START_SERVER_MODULES = [
  '@tanstack/react-start/server',
  '@tanstack/react-start-server',
  '@tanstack/start-server-core',
];

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

  const stubPath = fileURLToPath(import.meta.resolve('./export-mocks/start.js'));
  const startServerMockPath = fileURLToPath(import.meta.resolve('./export-mocks/start-server.js'));
  const startStorageContextMockPath = fileURLToPath(
    import.meta.resolve('./export-mocks/start-storage-context.js')
  );
  const routerMockPath = fileURLToPath(
    import.meta.resolve('@storybook/tanstack-react/react-router')
  );
  const basePlugins = reactConfig.plugins ?? [];
  const plugins = [
    ...basePlugins.filter((p) => !isTanStackStartPlugin(p)),
    serverCodeEliminationPlugin({ excludeFiles: [dirname(stubPath)] }),
    serverOnlyStubPlugin(),
    {
      name: 'storybook:tanstack-react:module-interception',
      enforce: 'pre' as const,
      resolveId: {
        order: 'pre' as const,
        handler(id: string, importer: string | undefined) {
          // Redirect @tanstack/react-router to our mock, except when
          // the importer IS the mock (to avoid a circular alias).
          if (
            (id === '@tanstack/react-router' || id.startsWith('@tanstack/react-router/')) &&
            importer &&
            !importer.includes('export-mocks')
          ) {
            return routerMockPath;
          }

          if (START_SERVER_MODULES.includes(id)) {
            return startServerMockPath;
          }

          if (id === '@tanstack/start-storage-context') {
            return startStorageContextMockPath;
          }

          // Intercept TanStack Start packages.
          for (const mod of INTERCEPTED_MODULES) {
            if (id === mod) {
              return stubPath;
            }
          }

          // Intercept virtual/server/worker entries
          for (const pattern of INTERCEPTED_PATTERNS) {
            if (id.includes(pattern)) {
              return stubPath;
            }
          }

          return null;
        },
      },

      config() {
        return {
          optimizeDeps: {
            exclude: [
              '@storybook/react',
              '@storybook/react/entry-preview',
              '@storybook/react/entry-preview-argtypes',
              '@storybook/react/entry-preview-docs',
              '@storybook/tanstack-react',
              '@tanstack/react-start/server',
              '@tanstack/react-start-server',
              '@tanstack/start-server-core',
            ],
          },
        };
      },
    },
  ];

  return {
    ...reactConfig,
    plugins,
  };
};
