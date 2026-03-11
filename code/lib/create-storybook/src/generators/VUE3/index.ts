import { ProjectType } from 'storybook/internal/cli';
import { SupportedBuilder, SupportedRenderer } from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.VUE3,
    renderer: SupportedRenderer.VUE3,
  },
  configure: async () => {
    return {
      extraPackages: async ({ builder }) => {
        return builder === SupportedBuilder.WEBPACK5
          ? ['vue-loader@^17.0.0', '@vue/compiler-sfc@^3.2.0']
          : [];
      },
      webpackCompiler: ({ builder }) => (builder === SupportedBuilder.WEBPACK5 ? 'swc' : undefined),
    };
  },
});
