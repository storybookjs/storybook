import path from 'node:path';

import { defaultExclude, defineProject, mergeConfig } from 'vitest/config';

import Inspect from 'vite-plugin-inspect';

import { vitestCommonConfig } from '../vitest.workspace';

const extraPlugins: any[] = [];
if (process.env.INSPECT === 'true') {
  // this plugin assists in inspecting the Storybook Vitest plugin's transformation and sourcemaps
  extraPlugins.push(
    Inspect({
      outputDir: '../.vite-inspect',
      build: true,
      open: true,
      include: ['**/*.stories.*'],
    })
  );
}

export default mergeConfig(
  vitestCommonConfig,
  // @ts-expect-error added this because of testNamePattern below
  defineProject({
    plugins: [
      import('@storybook/experimental-addon-test/vitest-plugin').then(({ storybookTest }) =>
        storybookTest({
          configDir: path.join(process.cwd(), '.storybook'),
          tags: {
            include: ['vitest'],
          },
        })
      ),
      ...extraPlugins,
    ],
    test: {
      name: 'storybook-ui',
      exclude: [
        ...defaultExclude,
        '../node_modules/**',
        '**/__mockdata__/**',
        '../**/__mockdata__/**',
        '**/Zoom.stories.tsx', // expected to fail in Vitest because of fetching /iframe.html to cause ECONNREFUSED
        '**/lib/blocks/src/**', // won't work because of https://github.com/storybookjs/storybook/issues/29783
      ],
      // TODO: bring this back once portable stories support @storybook/core/preview-api hooks
      // @ts-expect-error this type does not exist but the property does!
      testNamePattern: /^(?!.*(UseState)).*$/,
      browser: {
        enabled: true,
        name: 'chromium',
        provider: 'playwright',
        headless: true,
        screenshotFailures: false,
      },
      setupFiles: ['./storybook.setup.ts'],
      environment: 'happy-dom',
    },
  })
);
