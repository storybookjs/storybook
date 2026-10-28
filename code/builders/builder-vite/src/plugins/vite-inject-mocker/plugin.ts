import type { ResolvedConfig } from 'vite';

const ENTRY_PATH = '/vite-inject-mocker-entry.js';

export const viteInjectMockerRuntime = (options: {
  previewConfigPath?: string | null;
}): import('vite').Plugin => {
  // The actual file path, so Vite resolves relative imports; mocking utils load on first use.
  let mockerRuntimePath: string | undefined;
  const getMockerRuntimePath = async (): Promise<string> =>
    (mockerRuntimePath ??= (
      await import('@storybook/core/internal/mocking-utils')
    ).getMockerRuntimePath());

  let viteConfig: ResolvedConfig;

  return {
    name: 'vite:storybook-inject-mocker-runtime',
    enforce: 'pre',
    async buildStart() {
      if (viteConfig.command === 'build') {
        this.emitFile({
          type: 'chunk',
          id: await getMockerRuntimePath(),
          fileName: ENTRY_PATH.slice(1),
        });
      }
    },
    configResolved(config) {
      viteConfig = config;
    },
    configureServer(server) {
      if (options.previewConfigPath) {
        server.watcher.on('change', (file) => {
          if (file === options.previewConfigPath) {
            server.ws.send({
              type: 'custom',
              event: 'invalidate-mocker',
            });
          }
        });
      }
    },
    resolveId: {
      filter: { id: /\/vite-inject-mocker-entry\.js/ },
      async handler(source) {
        if (source === ENTRY_PATH) {
          return getMockerRuntimePath();
        }
        return undefined;
      },
    },
  };
};

/**
 * Locate the mocker runtime entry from the preview page. Builds use a relative URL so the page works
 * under a subpath; the dev server only resolves the absolute one.
 */
export function getMockerRuntimeUrl(command: 'serve' | 'build'): string {
  return command === 'build' ? `.${ENTRY_PATH}` : ENTRY_PATH;
}
