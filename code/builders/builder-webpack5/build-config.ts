import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
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
};

export default config;
