import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { Options } from 'storybook/internal/types';

import type { Plugin } from 'vite';

import { generateImportFnScriptCode } from '../codegen-importfn-script';
import { generateModernIframeScriptCode } from '../codegen-modern-iframe-script';
import { generateAddonSetupCode } from '../codegen-set-addon-channel';
import { transformIframeHtml } from '../transform-iframe-html';
import { SB_VIRTUAL_FILES, getResolvedVirtualModuleId } from '../virtual-file-names';

export function codeGeneratorPlugin(options: Options): Plugin {
  const iframePath = fileURLToPath(
    import.meta.resolve('@storybook/builder-vite/input/iframe.html')
  );
  let iframeId: string;
  let projectRoot: string;

  // noinspection JSUnusedGlobalSymbols
  return {
    name: 'storybook:code-generator-plugin',
    enforce: 'pre',
    configureServer(server) {
      // invalidate the whole vite-app.js script on every file change.
      // (this might be a little too aggressive?)
      server.watcher.on('change', () => {
        const appModule = server.moduleGraph.getModuleById(
          getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_APP_FILE)
        );
        if (appModule) {
          server.moduleGraph.invalidateModule(appModule);
        }
        const storiesModule = server.moduleGraph.getModuleById(
          getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE)
        );
        if (storiesModule) {
          server.moduleGraph.invalidateModule(storiesModule);
        }
      });

      // Adding new story files is not covered by the change event above. So we need to detect this and trigger
      // HMR to update the importFn.

      server.watcher.on('add', (path) => {
        // TODO maybe use the stories declaration in main
        if (/\.stories\.([tj])sx?$/.test(path) || /\.mdx$/.test(path)) {
          // We need to emit a change event to trigger HMR
          server.watcher.emit('change', SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE);
        }
      });
    },
    config(config, { command }) {
      // If we are building the static distribution, add iframe.html as an entry.
      // In development mode, it's not an entry - instead, we use a middleware
      // to serve iframe.html. The reason is that Vite's dev server (at the time of writing)
      // does not support virtual files as entry points.
      if (command === 'build') {
        if (!config.build) {
          config.build = {};
        }
        config.build.rollupOptions = {
          ...config.build.rollupOptions,
          input: iframePath,
        };
      }
    },
    configResolved(config) {
      projectRoot = config.root;
      iframeId = `${config.root}/iframe.html`;
    },
    resolveId(source) {
      if (source === SB_VIRTUAL_FILES.VIRTUAL_APP_FILE) {
        return getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_APP_FILE);
      }
      if (source === iframePath) {
        return iframeId;
      }
      if (source === SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE) {
        return getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE);
      }
      if (source === SB_VIRTUAL_FILES.VIRTUAL_PREVIEW_FILE) {
        return getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_PREVIEW_FILE);
      }
      if (source === SB_VIRTUAL_FILES.VIRTUAL_ADDON_SETUP_FILE) {
        return getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_ADDON_SETUP_FILE);
      }

      return undefined;
    },
    async load(id, config) {
      if (id === getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE)) {
        return generateImportFnScriptCode(options);
      }

      if (id === getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_ADDON_SETUP_FILE)) {
        return generateAddonSetupCode();
      }

      if (id === getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_APP_FILE)) {
        return generateModernIframeScriptCode(options, projectRoot);
      }

      if (id === iframeId) {
        return readFileSync(
          fileURLToPath(import.meta.resolve('@storybook/builder-vite/input/iframe.html')),
          'utf-8'
        );
      }

      return undefined;
    },
    async transformIndexHtml(html, ctx) {
      if (ctx.path !== '/iframe.html') {
        return undefined;
      }
      return transformIframeHtml(html, options);
    },
  };
}
