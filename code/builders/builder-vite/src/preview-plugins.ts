import './hooks.ts';

import type { Storybook } from '@storybook/core';
import { StorybookPackageRequiredError } from '@storybook/core/internal/server-errors';
import { serveStaticDirs } from '@storybook/core/internal/story-index';

import { resolve } from 'pathe';
import type { InlineConfig, Plugin, PluginOption } from 'vite';

import { getViteHookContext, viteCorePlugins } from './vite-config.ts';

/** Make a Vite server the builder does not own (e.g. Vitest's) serve the instance's preview. */
export async function vitePreviewPlugins(storybook: Storybook): Promise<PluginOption[]> {
  // The preview runtime ships with `storybook`; load it lazily so the builder runs without it.
  const { getPreviewSources } = await import('storybook/internal/preview-page').catch(
    (error: unknown) => {
      throw new StorybookPackageRequiredError({ feature: 'Vite preview plugins', error });
    }
  );
  const [corePlugins, { plugins = [], ...extendConfig }] = await Promise.all([
    getPreviewSources(storybook, { hmr: 'vite' }).then((preview) =>
      viteCorePlugins(storybook, preview)
    ),
    // The host server loads the user's Vite config itself, so only the project root seeds the hook.
    storybook.callHook(
      'builder:vite:extend',
      { root: resolve(storybook.configDir, '..') },
      getViteHookContext(storybook)
    ),
  ]);

  return [...corePlugins, ...plugins, previewHostPlugin(storybook, extendConfig)];
}

function previewHostPlugin(
  storybook: Storybook,
  extendConfig: Omit<InlineConfig, 'plugins'>
): Plugin {
  return {
    name: 'storybook:preview-host-plugin',
    async config() {
      const { mergeConfig } = await import('vite');
      return mergeConfig(
        { define: { FEATURES: JSON.stringify(storybook.options.features) } },
        extendConfig
      );
    },
    async transformIndexHtml(html) {
      const [frameworkOptions, headHtmlSnippet, bodyHtmlSnippet] = await Promise.all([
        storybook.callHook('core:framework-options:extend', undefined),
        storybook.callHook('preview:head:extend', undefined),
        storybook.callHook('preview:body:extend', undefined),
      ]);

      return html
        .replace(
          '</head>',
          `<script>window.FRAMEWORK_OPTIONS = ${JSON.stringify(frameworkOptions)};</script>${headHtmlSnippet ?? ''}</head>`
        )
        .replace('<body>', `<body>${bodyHtmlSnippet ?? ''}`);
    },
    configureServer(server) {
      const { staticDirs } = storybook.options;
      if (staticDirs) {
        serveStaticDirs(server.middlewares, { configDir: storybook.configDir, staticDirs });
      }
    },
  };
}
