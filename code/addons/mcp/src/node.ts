import { fileURLToPath } from 'node:url';

import { defineAddon } from '@storybook/core';
import type { Options } from '@storybook/core/internal/types';
// Types only: the product declares the `server:*` hooks this addon handles.
import type {} from 'storybook/internal/instance';

import { DEFAULT_MCP_ENDPOINT } from './constants.ts';
import { mountMcpServer } from './node/dev-server.ts';
import type { AddonOptionsInput } from './types.ts';

export type { AddonOptionsInput } from './types.ts';

export default defineAddon<AddonOptionsInput | void>((input) => {
  const options = input || {};
  return {
    meta: { name: '@storybook/addon-mcp' },
    setup(storybook): void {
      storybook.hook('server:mcp:extend', () => ({
        status: 'ready',
        endpoint: options.endpoint ?? DEFAULT_MCP_ENDPOINT,
      }));
      // Resolved from the package, as the preview is built outside the shared node chunks.
      storybook.hook('preview:annotations:collect', () => [
        fileURLToPath(
          new URL('./dist/preview.js', import.meta.resolve('@storybook/addon-mcp/package.json'))
        ),
      ]);
      storybook.hook('core:features:extend', (value) => ({
        ...value,
        componentsManifest: true,
      }));
      storybook.hook('server:app:extend', async (app) =>
        mountMcpServer(app, {
          // Core availability and composition helpers still read the options shape.
          ...(storybook.options as unknown as Options),
          ...options,
          core: await storybook.callHook('core:config:extend', {}),
          getIndex: () => storybook.getIndex(),
        })
      );
    },
  };
});
