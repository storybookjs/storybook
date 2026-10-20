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
import { getModuleLoader } from '../utils/module-loader.ts';
import {
  applyChunkedPreviewRuntime,
  bundlerOptionsKey,
  ensureRolldownOptions,
} from '../utils/vite-features.ts';
import {
  SB_VIRTUAL_FILES,
  SB_VIRTUAL_FILE_IDS,
  getResolvedVirtualModuleId,
} from '../virtual-file-names.ts';

const storiesFileId = getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE);

export function codeGeneratorPlugin(options: Options) {
  const iframePath = fileURLToPath(importMetaResolve('@storybook/builder-vite/input/iframe.html'));
  let iframeId: string;
  const storyIndexGeneratorPromise: Promise<StoryIndexGenerator> =
    options.presets.apply<StoryIndexGenerator>('storyIndexGenerator');
  // The code of the stories file as each Vite environment loads it, undefined for a load that
  // failed. An environment without an entry has not loaded the stories file since the builder asked
  // Vite to reload it, so it loads the current code when it next imports it.
  const loadedStoriesCode = new Map<string, Promise<string | undefined>>();

  const generateStoriesCode = async () => {
    const storyIndexGenerator = await storyIndexGeneratorPromise;
    const index = await storyIndexGenerator?.getIndex();
    return generateImportFnScriptCode(index, await getModuleLoader(options));
  };

  return {
    name: 'storybook:code-generator-plugin',
    enforce: 'pre',
    async configureServer(server) {
      // Vite reloads the stories file itself when a story file it imports changes, so a save sends
      // the preview one hot update. Vite cannot know about an added story file, so the stories file
      // is reloaded here when its code changes, that is when the set of story files changes, in
      // any environment that has loaded it. A load still in progress is waited for, as it may
      // have read the index from before this change.
      (await storyIndexGeneratorPromise).onInvalidated(async () => {
        if (loadedStoriesCode.size === 0) {
          return;
        }
        const [currentCode, ...loadedCodes] = await Promise.all([
          generateStoriesCode().catch(() => undefined),
          ...loadedStoriesCode.values(),
        ]);
        if (currentCode !== undefined && loadedCodes.every((code) => code === currentCode)) {
          return;
        }
        // Vite invalidates the stories file in every environment.
        loadedStoriesCode.clear();
        server.watcher.emit('change', storiesFileId);
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
        if (options.features?.experimentalChunkedPreviewRuntime) {
          applyChunkedPreviewRuntime(config);
        }
      }
    },
    configResolved(config) {
      iframeId = `${config.root}/iframe.html`;
    },
    resolveId(source) {
      if (SB_VIRTUAL_FILE_IDS.includes(source)) {
        return getResolvedVirtualModuleId(source);
      }
      if (source === iframePath) {
        return iframeId;
      }

      return undefined;
    },
    async load(id) {
      switch (id) {
        case storiesFileId: {
          const code = generateStoriesCode();
          loadedStoriesCode.set(
            this.environment.name,
            code.catch(() => undefined)
          );
          return code;
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
