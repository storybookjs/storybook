import type { Plugin } from 'vite';

const INTERCEPTED_PATTERNS = ['virtual:cloudflare', 'server-entry', 'worker-entry'];
const START_SERVER_MODULES = [
  '@tanstack/react-start',
  '@tanstack/react-start/server',
  '@tanstack/react-start-server',
  '@tanstack/start-server-core',
];

export function moduleInterceptionPlugin({
  startMockPath,
  startStorageContextMockPath,
  routerMockPath,
}: {
  startMockPath: string;
  startStorageContextMockPath: string;
  routerMockPath: string;
}): Plugin {
  return {
    name: 'storybook:tanstack-react:module-interception',
    enforce: 'pre',
    resolveId: {
      order: 'pre',
      async handler(id: string, importer: string | undefined) {
        const resolveMock = async (mockPath: string) => {
          const resolved = await this.resolve(mockPath, importer, { skipSelf: true });
          return resolved ?? mockPath;
        };

        // Redirect @tanstack/react-router to our mock, except when
        // the importer IS the mock (to avoid a circular alias).
        if (
          (id === '@tanstack/react-router' || id.startsWith('@tanstack/react-router/')) &&
          importer &&
          !importer.includes('export-mocks')
        ) {
          return resolveMock(routerMockPath);
        }

        if (START_SERVER_MODULES.includes(id) || id === '@tanstack/react-start') {
          return resolveMock(startMockPath);
        }

        if (id === '@tanstack/start-storage-context') {
          return resolveMock(startStorageContextMockPath);
        }

        // Intercept virtual/server/worker entries
        for (const pattern of INTERCEPTED_PATTERNS) {
          if (id.includes(pattern)) {
            return resolveMock(startMockPath);
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
            '@tanstack/react-start',
            '@tanstack/react-start/server',
            '@tanstack/react-start-server',
            '@tanstack/start-server-core',
          ],
        },
      };
    },
  };
}
