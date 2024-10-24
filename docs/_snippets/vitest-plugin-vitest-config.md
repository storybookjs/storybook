```ts filename="vitest.config.ts" renderer="react"
import { defineConfig, mergeConfig } from 'vitest/config';
import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin';
// 👇 If you're using Next.js, apply this framework plugin as well
// import { storybookNextJsPlugin } from '@storybook/experimental-nextjs-vite/vite-plugin';

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [
      storybookTest({
        // This should match your package.json script to run Storybook
        // The --ci flag will skip prompts and not open a browser
        storybookScript: 'yarn storybook --ci',
      }),
      // storybookNextJsPlugin(),
    ],
    test: {
      // Glob pattern to find story files
      include: ['src/**/*.stories.?(m)[jt]s?(x)'],
      // Enable browser mode
      browser: {
        enabled: true,
        name: 'chromium',
        // Make sure to install Playwright
        provider: 'playwright',
        headless: true,
      },
      // Speed up tests and better match how they run in Storybook itself
      // https://vitest.dev/config/#isolate
      // Consider removing this if you have flaky tests
      isolate: false,
      setupFiles: ['./.storybook/vitest.setup.ts'],
    },
  })
);
```

```ts filename="vitest.config.ts" renderer="vue"
import { defineConfig, mergeConfig } from 'vitest/config';
import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin';
import { storybookVuePlugin } from '@storybook/vue3-vite/vite-plugin';

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [
      storybookTest({
        // This should match your package.json script to run Storybook
        // The --ci flag will skip prompts and not open a browser
        storybookScript: 'yarn storybook --ci',
      }),
      storybookVuePlugin(),
    ],
    test: {
      // Glob pattern to find story files
      include: ['src/**/*.stories.?(m)[jt]s?(x)'],
      // Enable browser mode
      browser: {
        enabled: true,
        name: 'chromium',
        // Make sure to install Playwright
        provider: 'playwright',
        headless: true,
      },
      // Speed up tests and better match how they run in Storybook itself
      // https://vitest.dev/config/#isolate
      // Consider removing this if you have flaky tests
      isolate: false,
      setupFiles: ['./.storybook/vitest.setup.ts'],
    },
  })
);
```

```ts filename="vitest.config.ts" renderer="svelte"
import { defineConfig, mergeConfig } from 'vitest/config';
import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin';
// 👇 If you're using Sveltekit, apply this framework plugin as well
// import { storybookSveltekitPlugin } from '@storybook/sveltekit/vite-plugin';

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [
      storybookTest({
        // This should match your package.json script to run Storybook
        // The --ci flag will skip prompts and not open a browser
        storybookScript: 'yarn storybook --ci',
      }),
      // storybookSveltekitPlugin(),
    ],
    test: {
      // Glob pattern to find story files
      include: ['src/**/*.stories.?(m)[jt]s?(x)'],
      // Enable browser mode
      browser: {
        enabled: true,
        name: 'chromium',
        // Make sure to install Playwright
        provider: 'playwright',
        headless: true,
      },
      // Speed up tests and better match how they run in Storybook itself
      // https://vitest.dev/config/#isolate
      // Consider removing this if you have flaky tests
      isolate: false,
      setupFiles: ['./.storybook/vitest.setup.ts'],
    },
  })
);
```
