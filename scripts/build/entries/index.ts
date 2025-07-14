import { exec } from 'node:child_process';
import { join } from 'node:path';

import type { BuildEntriesByPackageName } from '../utils/entry-utils';

export const buildEntries = {
  storybook: {
    prebuild: async (cwd) => {
      const CORE_PREBUILD_SCRIPT_PATH = join(
        import.meta.dirname,
        'storybook',
        'generate-source-files.ts'
      );
      return new Promise((resolve, reject) => {
        const child = exec(`jiti ${CORE_PREBUILD_SCRIPT_PATH}`, {
          cwd,
          env: {
            ...process.env,
            NODE_ENV: 'production',
            FORCE_COLOR: '1',
            stdio: 'inherit',
          },
        });
        child.on('close', () => {
          resolve(void 0);
        });
        child.on('error', (error) => {
          reject(error);
        });
      });
    },
    postbuild: async (cwd) => {
      const { chmod } = await import('node:fs/promises');
      await chmod(join(cwd, 'dist', 'bin', 'dispatcher.js'), 0o755);
    },
    entries: {
      node: [
        {
          exportEntries: ['./internal/node-logger'],
          entryPoint: './src/node-logger/index.ts',
        },
        {
          exportEntries: ['./internal/server-errors'],
          entryPoint: './src/server-errors.ts',
        },
        {
          exportEntries: ['./internal/core-server'],
          entryPoint: './src/core-server/index.ts',
        },
        {
          entryPoint: './src/core-server/presets/common-preset.ts',
          dts: false,
        },
        {
          entryPoint: './src/core-server/presets/common-override-preset.ts',
          exportEntries: ['./internal/core-server/presets/common-override-preset'],
          dts: false,
        },
        {
          exportEntries: ['./internal/telemetry'],
          entryPoint: './src/telemetry/index.ts',
        },
        {
          exportEntries: ['./internal/csf-tools'],
          entryPoint: './src/csf-tools/index.ts',
        },
        {
          exportEntries: ['./internal/babel'],
          entryPoint: './src/babel/index.ts',
        },
        {
          exportEntries: ['./internal/bin/dispatcher'],
          entryPoint: './src/bin/dispatcher.ts',
          dts: false,
        },
        {
          entryPoint: './src/bin/core.ts',
          dts: false,
        },
        {
          exportEntries: ['./internal/bin/loader'],
          entryPoint: './src/bin/loader.ts',
          dts: false,
        },
        {
          exportEntries: ['./internal/common'],
          entryPoint: './src/common/index.ts',
        },
        {
          entryPoint: './src/cli/index.ts',
          exportEntries: ['./internal/cli'],
        },
      ],
      browser: [
        {
          exportEntries: ['./internal/client-logger'],
          entryPoint: './src/client-logger/index.ts',
        },

        {
          exportEntries: ['./internal/instrumenter'],
          entryPoint: './src/instrumenter/index.ts',
        },
        {
          exportEntries: ['./test', './internal/test'],
          entryPoint: './src/test/index.ts',
        },
        {
          exportEntries: ['./preview-api', './internal/preview-api'],
          entryPoint: './src/preview-api/index.ts',
        },
        {
          exportEntries: ['./highlight', './internal/highlight'],
          entryPoint: './src/highlight/index.ts',
        },
        {
          exportEntries: ['./actions', './internal/actions'],
          entryPoint: './src/actions/index.ts',
        },
        {
          exportEntries: ['./actions/decorator', './internal/actions/decorator'],
          entryPoint: './src/actions/decorator.ts',
        },
        {
          exportEntries: ['./viewport', './internal/viewport'],
          entryPoint: './src/viewport/index.ts',
        },
        {
          exportEntries: ['./internal/preview/globals'],
          entryPoint: './src/preview/globals.ts',
        },
        {
          exportEntries: ['./internal/csf'],
          entryPoint: './src/csf/index.ts',
        },
        {
          exportEntries: ['./internal/manager-errors'],
          entryPoint: './src/manager-errors.ts',
        },
        {
          exportEntries: ['./internal/preview-errors'],
          entryPoint: './src/preview-errors.ts',
        },
        {
          exportEntries: ['./internal/manager/globals'],
          entryPoint: './src/manager/globals.ts',
        },
        {
          entryPoint: './src/core-server/presets/common-manager.ts',
          dts: false,
        },
        {
          exportEntries: ['./theming', './internal/theming'],
          entryPoint: './src/theming/index.ts',
        },
        {
          exportEntries: ['./theming/create', './internal/theming/create'],
          entryPoint: './src/theming/create.ts',
        },
        {
          exportEntries: ['./internal/components'],
          entryPoint: './src/components/index.ts',
        },
        {
          exportEntries: ['./manager-api', './internal/manager-api'],
          entryPoint: './src/manager-api/index.ts',
        },
        {
          exportEntries: ['./internal/router'],
          entryPoint: './src/router/index.ts',
        },
        {
          exportEntries: ['./internal/docs-tools'],
          entryPoint: './src/docs-tools/index.ts',
        },
        {
          exportEntries: ['./internal/core-events'],
          entryPoint: './src/core-events/index.ts',
        },
        {
          exportEntries: ['./internal/channels'],
          entryPoint: './src/channels/index.ts',
        },
        {
          exportEntries: ['./internal/types'],
          entryPoint: './src/types/index.ts',
        },
      ],
      runtime: [
        {
          exportEntries: ['./internal/preview/runtime'],
          entryPoint: './src/preview/runtime.ts',
          dts: false,
        },
        {
          exportEntries: ['./internal/manager/globals-runtime'],
          entryPoint: './src/manager/globals-runtime.ts',
          dts: false,
        },
      ],
      globalizedRuntime: [
        {
          entryPoint: './src/manager/runtime.tsx',
          dts: false,
        },
      ],
    },
  },
  'create-storybook': {
    entries: {
      node: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
          dts: false,
        },
        {
          entryPoint: './src/bin/index.ts',
          dts: false,
        },
      ],
    },
    postbuild: async (cwd) => {
      const { chmod } = await import('node:fs/promises');
      await chmod(join(cwd, 'dist', 'bin', 'index.js'), 0o755);
    },
  },
  '@storybook/cli': {
    entries: {
      node: [
        {
          entryPoint: './src/bin/index.ts',
          dts: false,
        },
      ],
    },
    postbuild: async (cwd) => {
      const { chmod } = await import('node:fs/promises');
      await chmod(join(cwd, 'dist', 'bin', 'index.js'), 0o755);
    },
  },
  '@storybook/addon-a11y': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./preview'],
          entryPoint: './src/preview.tsx',
        },
        {
          exportEntries: ['./manager'],
          entryPoint: './src/manager.tsx',
          dts: false,
        },
      ],
      node: [
        {
          exportEntries: ['./postinstall'],
          entryPoint: './src/postinstall.ts',
          dts: false,
        },
      ],
    },
  },
  '@storybook/addon-docs': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./preview'],
          entryPoint: './src/preview.ts',
        },
        {
          exportEntries: ['./manager'],
          entryPoint: './src/manager.tsx',
          dts: false,
        },
        {
          exportEntries: ['./blocks'],
          entryPoint: './src/blocks.ts',
        },
        {
          exportEntries: ['./mdx-react-shim'],
          entryPoint: './src/mdx-react-shim.ts',
        },
        {
          exportEntries: ['./ember'],
          entryPoint: './src/ember/index.ts',
        },
        {
          exportEntries: ['./angular'],
          entryPoint: './src/angular/index.ts',
        },
        {
          exportEntries: ['./web-components'],
          entryPoint: './src/web-components/index.ts',
        },
        {
          exportEntries: ['./manager'],
          entryPoint: './src/manager.tsx',
          dts: false,
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
        {
          exportEntries: ['./mdx-loader'],
          entryPoint: './src/mdx-loader.ts',
          dts: false,
        },
      ],
    },
  },
  '@storybook/react-dom-shim': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/react-18.tsx',
        },
        {
          exportEntries: ['./react-16'],
          entryPoint: './src/react-16.tsx',
          dts: false,
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
      ],
    },
  },
  '@storybook/addon-jest': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./manager'],
          entryPoint: './src/manager.tsx',
          dts: false,
        },
      ],
    },
  },
  '@storybook/addon-links': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./react'],
          entryPoint: './src/react/index.ts',
        },
        {
          exportEntries: ['./preview'],
          entryPoint: './src/preview.ts',
        },
        {
          exportEntries: ['./manager'],
          entryPoint: './src/manager.ts',
          dts: false,
        },
      ],
    },
  },
  '@storybook/addon-onboarding': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./manager'],
          entryPoint: './src/manager.tsx',
          dts: false,
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
      ],
    },
  },
  'storybook-addon-pseudo-states': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./manager'],
          entryPoint: './src/manager.ts',
          dts: false,
        },
        {
          exportEntries: ['./preview'],
          entryPoint: './src/preview.ts',
        },
      ],
    },
  },
  '@storybook/addon-themes': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./manager'],
          entryPoint: './src/manager.tsx',
          dts: false,
        },
        {
          exportEntries: ['./preview'],
          entryPoint: './src/preview.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./postinstall'],
          entryPoint: './src/postinstall.ts',
          dts: false,
        },
      ],
    },
  },
  '@storybook/builder-vite': {
    entries: {
      node: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
      ],
    },
    extraOutputs: {
      './input/iframe.html': './input/iframe.html',
    },
  },
  '@storybook/builder-webpack5': {
    entries: {
      node: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./presets/custom-webpack-preset'],
          entryPoint: './src/presets/custom-webpack-preset.ts',
          dts: false,
        },
        {
          exportEntries: ['./presets/preview-preset'],
          entryPoint: './src/presets/preview-preset.ts',
          dts: false,
        },
        {
          exportEntries: ['./loaders/export-order-loader'],
          entryPoint: './src/loaders/export-order-loader.ts',
          dts: false,
        },
      ],
    },
    extraOutputs: {
      './templates/virtualModuleModernEntry.js': './templates/virtualModuleModernEntry.js',
      './templates/preview.ejs': './templates/preview.ejs',
      './templates/virtualModuleEntry.template.js': './templates/virtualModuleEntry.template.js',
      './templates/virtualModuleStory.template.js': './templates/virtualModuleStory.template.js',
    },
  },
  '@storybook/addon-vitest': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./manager'],
          entryPoint: './src/manager.tsx',
          dts: false,
        },
        {
          exportEntries: ['./internal/setup-file'],
          entryPoint: './src/vitest-plugin/setup-file.ts',
          dts: false,
        },
        {
          exportEntries: ['./internal/test-utils'],
          entryPoint: './src/vitest-plugin/test-utils.ts',
          dts: false,
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
        {
          exportEntries: ['./internal/global-setup'],
          entryPoint: './src/vitest-plugin/global-setup.ts',
          dts: false,
        },
        {
          exportEntries: ['./vitest'],
          entryPoint: './src/node/vitest.ts',
          dts: false,
        },
        {
          exportEntries: ['./postinstall'],
          entryPoint: './src/postinstall.ts',
          dts: false,
        },
        {
          exportEntries: ['./vitest-plugin'],
          entryPoint: './src/vitest-plugin/index.ts',
        },
        {
          exportEntries: ['./internal/coverage-reporter'],
          entryPoint: './src/node/coverage-reporter.ts',
          dts: false,
        },
      ],
    },
    extraOutputs: {
      './static/coverage-reporter.cjs': './static/coverage-reporter.cjs',
    },
  },
  '@storybook/html': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./entry-preview'],
          entryPoint: './src/entry-preview.ts',
          dts: false,
        },
        {
          exportEntries: ['./entry-preview-docs'],
          entryPoint: './src/entry-preview-docs.ts',
          dts: false,
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
      ],
    },
  },
  '@storybook/preact': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./entry-preview'],
          entryPoint: './src/entry-preview.ts',
          dts: false,
        },
        {
          exportEntries: ['./entry-preview-docs'],
          entryPoint: './src/entry-preview-docs.ts',
          dts: false,
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
      ],
    },
  },
  '@storybook/react': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./preview'],
          entryPoint: './src/preview.tsx',
        },
        {
          exportEntries: ['./entry-preview'],
          entryPoint: './src/entry-preview.tsx',
          dts: false,
        },
        {
          exportEntries: ['./entry-preview-argtypes'],
          entryPoint: './src/entry-preview-argtypes.ts',
          dts: false,
        },
        {
          exportEntries: ['./entry-preview-docs'],
          entryPoint: './src/entry-preview-docs.ts',
          dts: false,
        },
        {
          exportEntries: ['./entry-preview-rsc'],
          entryPoint: './src/entry-preview-rsc.tsx',
          dts: false,
        },
        {
          exportEntries: ['./experimental-playwright'],
          entryPoint: './src/playwright.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
      ],
    },
  },
  '@storybook/server': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./entry-preview'],
          entryPoint: './src/entry-preview.ts',
          dts: false,
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
      ],
    },
  },
  '@storybook/svelte': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./entry-preview'],
          entryPoint: './src/entry-preview.ts',
          dts: false,
        },
        {
          exportEntries: ['./entry-preview-docs'],
          entryPoint: './src/entry-preview-docs.ts',
          dts: false,
        },
        {
          exportEntries: ['./experimental-playwright'],
          entryPoint: './src/playwright.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
      ],
    },
    extraOutputs: {
      './internal/PreviewRender.svelte': './static/PreviewRender.svelte',
      './internal/DecoratorHandler.svelte': './static/DecoratorHandler.svelte',
      './internal/AddStorybookIdDecorator.svelte': './static/AddStorybookIdDecorator.svelte',
      './internal/createReactiveProps': './static/createReactiveProps.svelte.js',
    },
  },
  '@storybook/vue3': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./entry-preview'],
          entryPoint: './src/entry-preview.ts',
          dts: false,
        },
        {
          exportEntries: ['./entry-preview-docs'],
          entryPoint: './src/entry-preview-docs.ts',
          dts: false,
        },
        {
          exportEntries: ['./experimental-playwright'],
          entryPoint: './src/playwright.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
      ],
    },
  },
  '@storybook/web-components': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./entry-preview'],
          entryPoint: './src/entry-preview.ts',
          dts: false,
        },
        {
          exportEntries: ['./entry-preview-argtypes'],
          entryPoint: './src/entry-preview-argtypes.ts',
          dts: false,
        },
        {
          exportEntries: ['./entry-preview-docs'],
          entryPoint: './src/entry-preview-docs.ts',
          dts: false,
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
      ],
    },
  },
  '@storybook/html-vite': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
        {
          exportEntries: ['./node'],
          entryPoint: './src/node/index.ts',
        },
      ],
    },
  },
  '@storybook/nextjs': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./preview'],
          entryPoint: './src/preview.tsx',
        },
        {
          exportEntries: ['./cache.mock'],
          entryPoint: './src/export-mocks/cache/index.ts',
        },
        {
          exportEntries: ['./headers.mock'],
          entryPoint: './src/export-mocks/headers/index.ts',
        },
        {
          exportEntries: ['./navigation.mock'],
          entryPoint: './src/export-mocks/navigation/index.ts',
        },
        {
          exportEntries: ['./router.mock'],
          entryPoint: './src/export-mocks/router/index.ts',
        },
        {
          exportEntries: ['./compatibility/draft-mode.compat'],
          entryPoint: './src/compatibility/draft-mode.compat.ts',
          dts: false,
        },
        {
          exportEntries: ['./next-image-loader-stub'],
          entryPoint: './src/next-image-loader-stub.ts',
          dts: false,
        },
        {
          exportEntries: ['./image-context'],
          entryPoint: './src/image-context.ts',
          dts: false,
        },
        {
          exportEntries: ['./images/next-image'],
          entryPoint: './src/images/next-image.tsx',
          dts: false,
        },
        {
          exportEntries: ['./images/next-legacy-image'],
          entryPoint: './src/images/next-legacy-image.tsx',
          dts: false,
        },
        {
          exportEntries: ['./rsc/server-only'],
          entryPoint: './src/rsc/server-only.ts',
          dts: false,
        },
      ],
      node: [
        {
          exportEntries: ['./node'],
          entryPoint: './src/node/index.ts',
        },
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
        {
          exportEntries: ['./export-mocks'],
          entryPoint: './src/export-mocks/index.ts',
          dts: false,
        },
        {
          exportEntries: ['./next-swc-loader-patch'],
          entryPoint: './src/swc/next-swc-loader-patch.ts',
          dts: false,
        },
        {
          exportEntries: ['./storybook-nextjs-font-loader'],
          entryPoint: './src/font/webpack/loader/storybook-nextjs-font-loader.ts',
          dts: false,
        },
      ],
    },
  },
  '@storybook/preact-vite': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
        {
          exportEntries: ['./node'],
          entryPoint: './src/node/index.ts',
        },
      ],
    },
  },
  '@storybook/react-vite': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
        },
        {
          exportEntries: ['./node'],
          entryPoint: './src/node/index.ts',
        },
      ],
    },
  },
  '@storybook/react-webpack5': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
        {
          exportEntries: ['./node'],
          entryPoint: './src/node/index.ts',
        },
      ],
    },
  },
  '@storybook/server-webpack5': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
        {
          exportEntries: ['./node'],
          entryPoint: './src/node/index.ts',
        },
      ],
    },
  },
  '@storybook/svelte-vite': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
        },
        {
          exportEntries: ['./node'],
          entryPoint: './src/node/index.ts',
        },
      ],
    },
  },
  '@storybook/vue3-vite': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
        {
          exportEntries: ['./vite-plugin'],
          entryPoint: './src/vite-plugin.ts',
        },
        {
          exportEntries: ['./node'],
          entryPoint: './src/node/index.ts',
        },
      ],
    },
  },
  '@storybook/web-components-vite': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
        {
          exportEntries: ['./node'],
          entryPoint: './src/node/index.ts',
        },
      ],
    },
  },
  '@storybook/angular': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./client'],
          entryPoint: './src/client/index.ts',
        },
        {
          exportEntries: ['./client/config'],
          entryPoint: './src/client/config.ts',
        },
        {
          exportEntries: ['./client/preview-prod'],
          entryPoint: './src/client/preview-prod.ts',
        },
        {
          exportEntries: ['./client/docs/config'],
          entryPoint: './src/client/docs/config.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./node'],
          entryPoint: './src/node/index.ts',
        },
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },

        {
          exportEntries: ['./server/framework-preset-angular-ivy'],
          entryPoint: './src/server/framework-preset-angular-ivy.ts',
          dts: false,
        },
        {
          exportEntries: ['./server/framework-preset-angular-cli'],
          entryPoint: './src/server/framework-preset-angular-cli.ts',
          dts: false,
        },
        {
          exportEntries: ['./builders/start-storybook'],
          entryPoint: './src/builders/start-storybook/index.ts',
          dts: false,
        },
        {
          exportEntries: ['./builders/build-storybook'],
          entryPoint: './src/builders/build-storybook/index.ts',
          dts: false,
        },
      ],
    },
  },
  '@storybook/ember': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./node'],
          entryPoint: './src/node/index.ts',
        },
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
      ],
    },
  },
  '@storybook/nextjs-vite': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          exportEntries: ['./preview'],
          entryPoint: './src/preview.tsx',
        },
        {
          exportEntries: ['./cache.mock'],
          entryPoint: './src/export-mocks/cache/index.ts',
        },
        {
          exportEntries: ['./headers.mock'],
          entryPoint: './src/export-mocks/headers/index.ts',
        },
        {
          exportEntries: ['./navigation.mock'],
          entryPoint: './src/export-mocks/navigation/index.ts',
        },
        {
          exportEntries: ['./router.mock'],
          entryPoint: './src/export-mocks/router/index.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./node'],
          entryPoint: './src/node/index.ts',
        },
        {
          exportEntries: ['./vite-plugin'],
          entryPoint: './src/vite-plugin/index.ts',
        },
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
      ],
    },
  },
  '@storybook/react-native-web-vite': {
    entries: {
      browser: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
      ],
      node: [
        {
          exportEntries: ['./node'],
          entryPoint: './src/node/index.ts',
        },
        {
          exportEntries: ['./preset'],
          entryPoint: './src/preset.ts',
          dts: false,
        },
        {
          exportEntries: ['./vite-plugin'],
          entryPoint: './src/vite-plugin.ts',
        },
      ],
    },
  },
} satisfies BuildEntriesByPackageName;

export function isBuildEntries(key: string): key is keyof typeof buildEntries {
  return key in buildEntries;
}

export function hasPrebuild(
  entry: BuildEntriesByPackageName[keyof BuildEntriesByPackageName]
): entry is BuildEntriesByPackageName[keyof BuildEntriesByPackageName] & {
  prebuild: (cwd: string) => Promise<void>;
} {
  return 'prebuild' in entry;
}
