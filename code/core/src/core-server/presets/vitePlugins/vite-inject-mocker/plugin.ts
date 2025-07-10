import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { exactRegex } from '@rolldown/pluginutils';
import { dedent } from 'ts-dedent';
import type { ResolvedConfig, ViteDevServer } from 'vite';

import { __STORYBOOK_GLOBAL_THIS_ACCESSOR__ } from './constants';

const entryPath = '/vite-inject-mocker-entry.js';

const entryCode = dedent`
    <script type="module" src="${entryPath}"></script>
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
        this.emitFile({
          type: 'chunk',
          id: require.resolve(
            join(__dirname, '..', '..', '..', 'templates', 'mocker-runtime.template.js')
          ),
          fileName: entryPath.slice(1),
        });
      }
    },
    config() {
      return {
        optimizeDeps: {
          include: ['@vitest/mocker', '@vitest/mocker/browser'],
        },
        resolve: {
          alias: {
            '@vitest/mocker/browser': require.resolve('@vitest/mocker/browser'),
            '@vitest/mocker': require.resolve('@vitest/mocker'),
            '@vitest/spy': require.resolve('@vitest/spy'),
          },
        },
      };
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
        return readFileSync(
          require.resolve(
            join(__dirname, '..', '..', '..', 'templates', 'mocker-runtime.template.js')
          ),
          'utf-8'
        );
      }

      if (id.includes('@vitest/mocker/dist/register.js')) {
        const content = await readFile(require.resolve('@vitest/mocker/dist/register.js'), 'utf-8');
        const result = content
          .replace(
            /__VITEST_GLOBAL_THIS_ACCESSOR__/g,
            JSON.stringify(__STORYBOOK_GLOBAL_THIS_ACCESSOR__)
          )
          .replace('__VITEST_MOCKER_ROOT__', JSON.stringify(server?.config.root ?? ''));
        return result;
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
