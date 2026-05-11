import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import type { BrowserCommand } from 'vitest/node';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const resetMousePosition: BrowserCommand<[number, number]> = async (ctx) => {
  if (ctx.provider.name !== 'playwright')
    throw new Error('resetMousePosition requires the Playwright provider');
  const frame = await ctx.frame();
  await frame.page().mouse.move(-1000, -1000);
};

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  test: {
    workspace: [
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, 'CONFIG_DIR') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: 'playwright',
            instances: [{ browser: 'chromium' }],
            commands: {
              resetMousePosition,
            },
          },
        },
      },
    ],
  },
});
