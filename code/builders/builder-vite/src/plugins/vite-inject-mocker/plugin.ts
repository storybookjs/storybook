import { getMockerRuntime } from 'storybook/internal/mocking-utils';

import { exactRegex } from '@rolldown/pluginutils';
import { dedent } from 'ts-dedent';
import type { ResolvedConfig, ViteDevServer } from 'vite';

const entryPath = '/vite-inject-mocker-entry.js';

const entryCode = dedent`
    <script type="module" src=".${entryPath}"></script>
  `;

let server: ViteDevServer;

export const viteInjectMockerRuntime = (options: {
  previewConfigPath?: string | null;
}): import('vite').Plugin => {
  let viteConfig: ResolvedConfig;

  return {
    name: 'vite:storybook-inject-mocker-runtime',
    buildStart() {
      if (viteConfig.command === 'build') {
        // Emit the pre-bundled mocker runtime as an asset
        this.emitFile({
          type: 'asset',
          fileName: entryPath.slice(1),
          source: getMockerRuntime(),
        });
      }
    },
    configResolved(config) {
      viteConfig = config;
    },
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
    resolveId: {
      filter: {
        id: [exactRegex(entryPath)],
      },
      handler(id) {
        if (exactRegex(id).test(entryPath)) {
          return id;
        }
        return null;
      },
    },
    async load(id) {
      if (exactRegex(id).test(entryPath)) {
        return getMockerRuntime();
      }

      return null;
    },
    transformIndexHtml(html: string) {
      const headTag = html.match(/<head[^>]*>/);

      if (headTag) {
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
