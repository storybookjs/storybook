import { resolvePackageDir } from 'storybook/internal/common';

import { join } from 'pathe';
import type { ViteDevServer } from 'vite';

const entryPath = '/vite-inject-mocker-entry.js';

let server: ViteDevServer;

export const viteInjectMockerRuntime = (options: {
  previewConfigPath?: string | null;
}): import('vite').Plugin => {
  // Get the actual file path so Vite can resolve relative imports
  const mockerRuntimePath = join(
    resolvePackageDir('storybook'),
    'dist',
    'mocking-utils',
    'mocker-runtime.js'
  );

  return {
    name: 'vite:storybook-inject-mocker-runtime',
    enforce: 'pre',
    configureServer(server_) {
      server = server_;
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
      if (source === entryPath) {
        // Return the actual file path so Vite can resolve relative imports
        return mockerRuntimePath;
      }
      return undefined;
    },
    transformIndexHtml(html: string) {
      const headTag = html.match(/<head[^>]*>/);

      if (headTag) {
        const entryCode = `<script type="module" src="${entryPath}"></script>`;
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
