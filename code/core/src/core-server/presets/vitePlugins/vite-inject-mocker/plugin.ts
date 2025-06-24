import { readFile } from 'node:fs/promises';

import { exactRegex } from '@rolldown/pluginutils';
import { dedent } from 'ts-dedent';
import type { ViteDevServer } from 'vite';

const entryPath = '/vite-inject-mocker-entry.js';

const entryCode = dedent`
    <script type="module" src="${entryPath}"></script>
  `;

const __STORYBOOK_GLOBAL_THIS_ACCESSOR__ = '__vitest_mocker__';

const runtimeCode = () => dedent`
  import { ModuleMockerServerInterceptor } from "@vitest/mocker/browser";
  import { registerModuleMocker } from "@vitest/mocker/register";
  globalThis.__STORYBOOK_MOCKER__ = registerModuleMocker((globalThisAccessor) => new ModuleMockerServerInterceptor(globalThisAccessor));

  if (import.meta.hot) {
    import.meta.hot.on('invalidate-mocker', (payload) => {
      globalThis.${__STORYBOOK_GLOBAL_THIS_ACCESSOR__}.invalidate();
    });
  }
`;

let server: ViteDevServer;

export const viteInjectMockerRuntime = (options: {
  previewConfigPath?: string | null;
}): import('vite').Plugin => ({
  name: 'vite:inject-mocker-runtime',
  config() {
    return {
      resolve: {
        // external: ['msw/browser', 'msw/core/http'],
      },
    };
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
      return runtimeCode();
    }

    if (id.includes('@vitest/mocker/dist/register.js')) {
      console.log(id);
      if (!server) {
        // mocker doesn't work during build
        return 'export {}';
      }

      const content = await readFile(require.resolve('@vitest/mocker/dist/register.js'), 'utf-8');
      const result = content
        .replace(
          /__VITEST_GLOBAL_THIS_ACCESSOR__/g,
          JSON.stringify(__STORYBOOK_GLOBAL_THIS_ACCESSOR__)
        )
        .replace('__VITEST_MOCKER_ROOT__', JSON.stringify(server.config.root));
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
});
