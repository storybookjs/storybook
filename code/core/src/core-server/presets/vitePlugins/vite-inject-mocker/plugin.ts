import { readFile } from 'node:fs/promises';

import { exactRegex } from '@rolldown/pluginutils';
import { dedent } from 'ts-dedent';
import type { ResolvedConfig, ViteDevServer } from 'vite';

import {
  VIRTUAL_MODULE_MOCKER_BUILD_INTERCEPTOR,
  __STORYBOOK_GLOBAL_THIS_ACCESSOR__,
} from './utils';
import { runtimeCode } from './utils';

const entryPath = '/vite-inject-mocker-entry.js';
const setupPath = '/setup.js';

const entryCode = dedent`
    <script type="module" src="${setupPath}"></script>
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
          id: require.resolve('../../../templates/mocker-runtime-build-code.template.js'),
          fileName: entryPath.slice(1),
        });
        this.emitFile({
          type: 'chunk',
          id: require.resolve('../../../templates/setup.template.js'),
          fileName: setupPath.slice(1),
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
        id: [
          exactRegex(entryPath),
          exactRegex(setupPath),
          exactRegex(VIRTUAL_MODULE_MOCKER_BUILD_INTERCEPTOR),
        ],
      },
      handler(id) {
        if (
          exactRegex(id).test(entryPath) ||
          exactRegex(id).test(setupPath) ||
          exactRegex(id).test(VIRTUAL_MODULE_MOCKER_BUILD_INTERCEPTOR)
        ) {
          return id;
        }
        return null;
      },
    },
    async load(id) {
      if (exactRegex(id).test(entryPath)) {
        return runtimeCode(viteConfig.command);
      }

      if (exactRegex(id).test(setupPath)) {
        return dedent`
          import { setup } from 'storybook/internal/preview/runtime';
          setup();
        `;
      }

      if (exactRegex(id).test(VIRTUAL_MODULE_MOCKER_BUILD_INTERCEPTOR)) {
        return await readFile(
          require.resolve('./vitePlugins/vite-inject-mocker/module-mocker-build-interceptor.js'),
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
