import type { Options } from 'storybook/internal/types';

import type { HmrContext, Plugin } from 'vite';

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
