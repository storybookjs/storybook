import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import type { Options } from 'storybook/internal/types';

import type { Plugin } from 'vite';

import { importMetaResolve } from '../../../../core/src/shared/utils/module';
import { generateImportFnScriptCode } from '../codegen-importfn-script';
import { generateModernIframeScriptCode } from '../codegen-modern-iframe-script';
import { generateAddonSetupCode } from '../codegen-set-addon-channel';
import { transformIframeHtml } from '../transform-iframe-html';
import { SB_VIRTUAL_FILES, getResolvedVirtualModuleId } from '../virtual-file-names';

export function codeGeneratorPlugin(options: Options): Plugin {
  const iframePath = fileURLToPath(importMetaResolve('@storybook/builder-vite/input/iframe.html'));
  let iframeId: string;
  let projectRoot: string;
  let storyIndexGenerator: StoryIndexGenerator | undefined;

  return {
    name: 'storybook:code-generator-plugin',
    enforce: 'pre',
    async configureServer(server) {
      storyIndexGenerator = await options?.getStoryIndexGenerator?.();
      storyIndexGenerator?.onInvalidated(() => {
        server.watcher.emit(
          'change',
          getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE)
        );
      });
    },
    async buildStart() {
      // configureServer is not called in build mode, so we need to initialize the storyIndexGenerator here
      // in dev mode it will have been set in configureServer already
      storyIndexGenerator ??= await options?.getStoryIndexGenerator?.();
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
      if (Object.values(SB_VIRTUAL_FILES).includes(source)) {
        return getResolvedVirtualModuleId(source);
      }
      if (source === iframePath) {
        return iframeId;
      }

      return undefined;
    },
    async load(id) {
      switch (id) {
        case getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE):
          return generateImportFnScriptCode(
            (await storyIndexGenerator?.getIndex()) ?? { v: 5, entries: {} }
          );

        case getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_ADDON_SETUP_FILE):
          return generateAddonSetupCode();

        case getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_APP_FILE):
          return generateModernIframeScriptCode(options, projectRoot);

        case iframeId:
          return readFileSync(
            fileURLToPath(importMetaResolve('@storybook/builder-vite/input/iframe.html')),
            'utf-8'
          );
      }
    },
    async transformIndexHtml(html, ctx) {
      if (ctx.path !== '/iframe.html') {
        return undefined;
      }
      return transformIframeHtml(html, options);
    },
  };
}
