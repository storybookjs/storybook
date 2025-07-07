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
          entryPoint: './src/builder-manager/index.ts',
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
    extraOutputs: {
      './svelte/HOC.svelte': './svelte/HOC.svelte',
    },
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
