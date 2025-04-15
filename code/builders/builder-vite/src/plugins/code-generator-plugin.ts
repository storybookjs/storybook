import { readFile } from 'node:fs/promises';

import type { Options } from 'storybook/internal/types';

import type { HmrContext, Plugin } from 'vite';

import { transformIframeHtml } from '../transform-iframe-html';

export function codeGeneratorPlugin(options: Options): Plugin {
  const iframePath = require.resolve('@storybook/builder-vite/input/iframe.html');

  return {
    name: '@storybook/builder-vite:code-generator',
    enforce: 'pre',
    config(config, { command }) {
      // If we are building the static distribution, add iframe.html as an entry
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
    async transformIndexHtml(html, ctx) {
      if (!ctx.path?.endsWith('iframe.html')) {
        return html;
      }

      const template = await readFile(iframePath, 'utf-8');
      return transformIframeHtml(template, options);
    },
    handleHotUpdate(ctx: HmrContext) {
      // Invalidate iframe.html when stories change
      if (/\.stories\.([tj])sx?$/.test(ctx.file) || /\.mdx$/.test(ctx.file)) {
        // Force a full reload when stories change
        ctx.server.ws.send({ type: 'full-reload' });
      }
      return undefined;
    },
  };
}
