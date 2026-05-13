import type { Options } from 'storybook/internal/types';

import type { Plugin, PluginOption } from 'vite';
import { codeGeneratorPlugin } from '../../plugins/code-generator-plugin';
import { csfPlugin } from '../../plugins/csf-plugin';
import { injectExportOrderPlugin } from '../../plugins/inject-export-order-plugin';
import { storybookExternalGlobalsPlugin } from '../../plugins/storybook-external-globals-plugin';
import { stripStoryHMRBoundary } from '../../plugins/strip-story-hmr-boundaries';
import { transformIframeHtml } from '../../transform-iframe-html';

export async function getPreviewPlugins(
  options: Options,
  basePath: string
): Promise<PluginOption[]> {
  const corePlugins = await options.presets.apply<PluginOption[]>('viteCorePlugins', []);
  const entryPlugins = await getEntryPlugins(options, basePath);

  const globalsPlugin = await storybookExternalGlobalsPlugin(options);
  const adaptedGlobalsPlugin: Plugin = {
    ...globalsPlugin,
    apply: 'serve',
  };

  return [...corePlugins, adaptedGlobalsPlugin, await csfPlugin(options), ...entryPlugins];
}

async function getEntryPlugins(options: Options, basePath: string): Promise<Plugin[]> {
  const baseCodeGenPlugin = codeGeneratorPlugin(options);

  const adaptedCodeGenPlugin: Plugin = {
    ...baseCodeGenPlugin,
    async transformIndexHtml(html, ctx) {
      if (ctx.server) {
        return undefined;
      }
      const expectedPath = `${basePath}iframe.html`;
      if (ctx.path !== expectedPath && ctx.path !== '/iframe.html') {
        return undefined;
      }
      return transformIframeHtml(html, options);
    },
  };

  return [adaptedCodeGenPlugin, await injectExportOrderPlugin(), await stripStoryHMRBoundary()];
}
