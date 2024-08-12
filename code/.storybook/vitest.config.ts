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
  defineProject({
    plugins: [
      import('@storybook/experimental-addon-vitest/plugin').then(({ storybookTest }) =>
        storybookTest({
          configDir: process.cwd(),
        })
      ),
      ...extraPlugins,
    ],
    test: {
      name: 'storybook-ui',
      include: [
        // TODO: test all core and addon stories later
        // './core/**/components/**/*.{story,stories}.?(c|m)[jt]s?(x)',
        '../addons/interactions/**/*.{story,stories}.?(c|m)[jt]s?(x)',
      ],
      exclude: [
        ...defaultExclude,
        '../node_modules/**',
        '**/__mockdata__/**',
        // expected to fail in Vitest because of fetching /iframe.html to cause ECONNREFUSED
        '**/Zoom.stories.tsx',
      ],
      browser: {
        enabled: true,
        name: 'chromium',
        provider: 'playwright',
        headless: true,
        screenshotFailures: true,
      },
      setupFiles: ['./storybook.setup.ts'],
      environment: 'happy-dom',
    },
  })
);
