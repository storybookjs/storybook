import { mergeConfig, defaultExclude, defineProject } from 'vitest/config';
import { vitestCommonConfig } from '../vitest.workspace';

export default mergeConfig(
  vitestCommonConfig,
  defineProject({
    plugins: [
      import('@storybook/experimental-addon-vitest/plugin').then(({ storybookTest }) =>
        storybookTest({
          storybookScript: 'yarn storybook:ui --ci',
        })
      ),
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
