import { fileURLToPath } from 'node:url';

import type { ResolvedConfig } from 'vite';

const ENTRY_PATH = '/vite-inject-mocker-entry.js';

export const viteInjectMockerRuntime = (options: {
  previewConfigPath?: string | null;
}): import('vite').Plugin => {
  // Get the actual file path so Vite can resolve relative imports
  const mockerRuntimePath = fileURLToPath(
    import.meta.resolve('storybook/internal/mocking-utils/mocker-runtime')
  );

  let viteConfig: ResolvedConfig;

  return {
    name: 'vite:storybook-inject-mocker-runtime',
    enforce: 'pre',
    buildStart() {
      if (viteConfig.command === 'build') {
        this.emitFile({
          type: 'chunk',
          id: mockerRuntimePath,
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
    resolveId(source) {
      if (source === ENTRY_PATH) {
        return mockerRuntimePath;
      }
      return undefined;
    },
    transformIndexHtml(html: string) {
      const headTag = html.match(/<head[^>]*>/);

      if (headTag) {
        // Use a relative path for production builds so the script loads
        // correctly when artifacts are hosted at non-root paths (e.g.,
        // GitHub Pages subdirectories).  In dev mode, the absolute path
        // is required so Vite's dev server can match it in resolveId.
        const src = viteConfig.command === 'build' ? `.${ENTRY_PATH}` : ENTRY_PATH;
        const entryCode = `<script type="module" src="${src}"></script>`;
        const headTagIndex = html.indexOf(headTag[0]);
        const newHtml =
          html.slice(0, headTagIndex + headTag[0].length) +
          entryCode +
          html.slice(headTagIndex + headTag[0].length);
        return newHtml;
      }
    },
  };
};
