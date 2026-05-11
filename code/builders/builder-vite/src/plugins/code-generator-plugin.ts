import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import type { Options } from 'storybook/internal/types';

import type { Plugin } from 'vite';

import { importMetaResolve } from '../../../../core/src/shared/utils/module.ts';
import { generateImportFnScriptCode } from '../codegen-importfn-script.ts';
import { generateModernIframeScriptCode } from '../codegen-modern-iframe-script.ts';
import { generateAddonSetupCode } from '../codegen-set-addon-channel.ts';
import { transformIframeHtml } from '../transform-iframe-html.ts';
import { bundlerOptionsKey, ensureRolldownOptions } from '../utils/vite-features.ts';
import {
  SB_VIRTUAL_FILES,
  SB_VIRTUAL_FILE_IDS,
  getResolvedVirtualModuleId,
} from '../virtual-file-names.ts';

export function codeGeneratorPlugin(options: Options) {
  const iframePath = fileURLToPath(importMetaResolve('@storybook/builder-vite/input/iframe.html'));
  let iframeId: string;
  const storyIndexGeneratorPromise: Promise<StoryIndexGenerator> =
    options.presets.apply<StoryIndexGenerator>('storyIndexGenerator');

  return {
    name: 'storybook:code-generator-plugin',
    enforce: 'pre',
    async configureServer(server) {
      (await storyIndexGeneratorPromise).onInvalidated(() => {
        // TODO: this is only necessary when new files are added.
        // Changes and removals are already watched and handled by Vite, so they actually trigger a double HMR event right now.
        server.watcher.emit(
          'change',
          getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE)
        );
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
        // TODO: Remove bundlerOptionsKey and use 'rolldownOptions' directly once support for Vite < 8 is dropped
        const build = config.build as Record<string, any>;

        // shared options between rollup/rolldown
        build[bundlerOptionsKey] = {
          ...build[bundlerOptionsKey],
          input: iframePath,
        };

        // necessary rolldown specific overrides
        ensureRolldownOptions(config);
      }
    },
    configResolved(config) {
      iframeId = `${config.root}/iframe.html`;
    },
    resolveId(source) {
      // Strip query string before matching the canonical virtual module IDs.
      // Per-environment routing addons (e.g. `addon-before-after`) tag
      // bare-spec imports with markers like `?env=before` so the addon's
      // dispatch middleware can route them to a non-`client` Vite
      // environment. Without this normalisation, strict equality on
      // `source` misses the marker-tagged form and Vite falls through to
      // a 404 disk lookup. The query is preserved on the resolved ID so
      // Vite's module graph still partitions marker-tagged modules from
      // their plain counterparts.
      const [bareSource, query] = source.split('?');
      const querySuffix = query ? `?${query}` : '';
      if (SB_VIRTUAL_FILE_IDS.includes(bareSource)) {
        return `${getResolvedVirtualModuleId(bareSource)}${querySuffix}`;
      }
      if (bareSource === iframePath) {
        return iframeId;
      }

      return undefined;
    },
    async load(id) {
      // Mirror the query-tolerance from `resolveId`: drop the query before
      // matching the canonical resolved virtual IDs. Generated module
      // bodies are query-independent — the marker only affects dispatch.
      const bareId = id.split('?')[0];
      switch (bareId) {
        case getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE): {
          const storyIndexGenerator = await storyIndexGeneratorPromise;
          const index = await storyIndexGenerator?.getIndex();
          return generateImportFnScriptCode(index);
        }

        case getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_ADDON_SETUP_FILE): {
          return generateAddonSetupCode();
        }
        case getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_APP_FILE): {
          return generateModernIframeScriptCode(options);
        }
        case iframeId: {
          return readFileSync(
            fileURLToPath(importMetaResolve('@storybook/builder-vite/input/iframe.html')),
            'utf-8'
          );
        }
      }
    },
    async transformIndexHtml(html, ctx) {
      if (ctx.path !== '/iframe.html') {
        return undefined;
      }
      return transformIframeHtml(html, options);
    },
  } satisfies Plugin;
}
