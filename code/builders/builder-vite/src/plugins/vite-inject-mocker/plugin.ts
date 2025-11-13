import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolvePackageDir } from 'storybook/internal/common';

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
        this.emitFile({
          type: 'chunk',
          id: join(
            resolvePackageDir('storybook'),
            'assets',
            'server',
            'mocker-runtime.template.js'
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
          // Aliasing necessary for package managers like pnpm, since resolving modules from a virtual module
          // leads to errors, if the imported module is not a dependency of the project.
          // By resolving the module to the real path, we can avoid this issue.
          alias: {
            '@vitest/mocker/browser': fileURLToPath(import.meta.resolve('@vitest/mocker/browser')),
            '@vitest/mocker': fileURLToPath(import.meta.resolve('@vitest/mocker')),
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
          join(resolvePackageDir('storybook'), 'assets', 'server', 'mocker-runtime.template.js'),
          'utf-8'
        );
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
