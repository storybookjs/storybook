import type { Storybook } from '@storybook/core';
import type { PreviewSources } from '@storybook/core/internal/preview-page';

import type { Plugin } from 'vite';

import { generateImportFnScriptCode } from '../codegen-importfn-script.ts';
import {
  applyChunkedPreviewRuntime,
  bundlerOptionsKey,
  ensureRolldownOptions,
} from '../utils/vite-features.ts';
import { getMockerRuntimeUrl } from './vite-inject-mocker/plugin.ts';

const IFRAME_INPUT = 'virtual:/@storybook/builder-vite/iframe.html';

const APP_LOADING_ERROR_HANDLER = `<script>
      function __onViteAppLoadingError(event) {
        const hostname = globalThis.location.hostname;
        if (hostname !== 'localhost' && globalThis.CONFIG_TYPE === 'DEVELOPMENT') {
          const message = \`Failed to load the Storybook preview file 'vite-app.js':

      It looks like you're visiting the Storybook development server on another hostname than localhost: '\${hostname}', but you haven't configured the necessary security features to support this.
      Please re-run your Storybook development server with the '--host \${hostname}' flag, or manually configure your Vite allowedHosts configuration with viteFinal.

      See:\`;
          const docs = [
            'https://storybook.js.org/docs/api/cli-options#dev',
            'https://storybook.js.org/docs/api/main-config/main-config-vite-final',
            'https://vite.dev/config/server-options.html#server-allowedhosts',
          ];
          console.error(\`\${message}\\n\${docs.map((doc) => \`- \${doc}\`).join('\\n')}\`);

          document.getElementById('storybook-root').innerHTML =
            \`<p style="color: red; max-width: 70ch">\${message.replaceAll(
              '\\n',
              '<br/>'
            )}<ul>\${docs.map((doc) => \`<li><a href='\${doc}' target='_blank'>\${doc}</a></li>\`).join('')}</ul></p>\`;
          return;
        }
      }
    </script>`;

/**
 * Render the page Vite processes. Core's page wraps the result afterwards, so preview head and body
 * snippets never go through Vite's HTML processing.
 */
export function getIframeHtml(preview: PreviewSources): string {
  return `<!doctype html>
<html>
  <head></head>
  <body>
    ${APP_LOADING_ERROR_HANDLER}
    <script
      type="module"
      src="${preview.virtualModuleIds.entry}"
      onerror="__onViteAppLoadingError(event)"
    ></script>
  </body>
</html>
`;
}

/** Serve the preview page, core's preview modules, and the story importer. */
export function codeGeneratorPlugin(storybook: Storybook, preview: PreviewSources): Plugin {
  const ids = preview.virtualModuleIds;
  const modules = new Map([
    [`\0${ids.entry}`, preview.modules.entry],
    [`\0${ids.addonSetup}`, preview.modules.addonSetup],
  ]);
  const importFnId = `\0${ids.importFn}`;
  let iframeId: string;

  return {
    name: 'storybook:code-generator-plugin',
    enforce: 'pre',
    async configureServer(server) {
      (await storybook.getStoryIndexGenerator()).onInvalidated(() => {
        // TODO: this is only necessary when new files are added.
        // Changes and removals are already watched and handled by Vite, so they actually trigger a double HMR event right now.
        server.watcher.emit('change', importFnId);
      });
    },
    config(config, { command }) {
      // Vite's dev server cannot use a virtual page as an entry, so dev serves it from a middleware.
      if (command === 'build') {
        if (!config.build) {
          config.build = {};
        }
        // TODO: Remove bundlerOptionsKey and use 'rolldownOptions' directly once support for Vite < 8 is dropped
        const build = config.build as Record<string, any>;

        build[bundlerOptionsKey] = {
          ...build[bundlerOptionsKey],
          input: IFRAME_INPUT,
        };

        ensureRolldownOptions(config);
        if (storybook.options.features?.experimentalChunkedPreviewRuntime) {
          applyChunkedPreviewRuntime(config);
        }
      }
    },
    configResolved(config) {
      iframeId = `${config.root}/iframe.html`;
    },
    resolveId(source) {
      if (source === ids.importFn || modules.has(`\0${source}`)) {
        return `\0${source}`;
      }
      if (source === IFRAME_INPUT) {
        return iframeId;
      }
      return undefined;
    },
    async load(id) {
      if (id === importFnId) {
        const generator = await storybook.getStoryIndexGenerator();
        return generateImportFnScriptCode(await generator.getIndex());
      }
      if (id === iframeId) {
        return getIframeHtml(preview);
      }
      return modules.get(id);
    },
    transformIndexHtml(html, ctx) {
      if (ctx.path !== '/iframe.html') {
        return undefined;
      }
      const head = html.match(/<head[^>]*>([\s\S]*)<\/head>/)?.[1] ?? '';
      const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] ?? '';
      return preview.html({
        head,
        scripts: ctx.server ? body.replace(ids.entry, `/@id/__x00__${ids.entry}`) : body,
        mockerRuntimeUrl: getMockerRuntimeUrl(ctx.server ? 'serve' : 'build'),
      });
    },
  };
}
