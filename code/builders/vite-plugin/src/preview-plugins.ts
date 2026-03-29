import type { Options } from 'storybook/internal/types';

import type { Plugin, PluginOption } from 'vite';

import { codeGeneratorPlugin } from '../../builder-vite/src/plugins/code-generator-plugin';
import { csfPlugin } from '../../builder-vite/src/plugins/csf-plugin';
import { injectExportOrderPlugin } from '../../builder-vite/src/plugins/inject-export-order-plugin';
import { storybookExternalGlobalsPlugin } from '../../builder-vite/src/plugins/storybook-external-globals-plugin';
import { stripStoryHMRBoundary } from '../../builder-vite/src/plugins/strip-story-hmr-boundaries';

export async function getPreviewPlugins(
  options: Options,
  basePath: string
): Promise<PluginOption[]> {
  const corePlugins = await options.presets.apply<PluginOption[]>('viteCorePlugins', []);
  const entryPlugins = await getEntryPlugins(options, basePath);

  return [
    ...corePlugins,
    await storybookExternalGlobalsPlugin(options),
    await csfPlugin(options),
    ...entryPlugins,
  ];
}

async function getEntryPlugins(options: Options, basePath: string): Promise<Plugin[]> {
  const baseCodeGenPlugin = codeGeneratorPlugin(options);

  const adaptedCodeGenPlugin: Plugin = {
    ...baseCodeGenPlugin,
    // Vite 8 does not register transformIndexHtml hooks for plugins returned
    // from config(). The iframe-middleware calls transformIframeHtml directly.
    transformIndexHtml: undefined,
  };

  return [adaptedCodeGenPlugin, await injectExportOrderPlugin(), await stripStoryHMRBoundary()];
}
