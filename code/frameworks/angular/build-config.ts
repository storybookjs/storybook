import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    browser: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./client'],
        entryPoint: './src/client/index.ts',
        dts: false,
      },
      {
        exportEntries: ['./client/config'],
        entryPoint: './src/client/config.ts',
        dts: false,
      },
      {
        exportEntries: ['./client/preview-prod'],
        entryPoint: './src/client/preview-prod.ts',
        dts: false,
      },
      {
        exportEntries: ['./client/docs/config'],
        entryPoint: './src/client/docs/config.ts',
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
};

export default config;
