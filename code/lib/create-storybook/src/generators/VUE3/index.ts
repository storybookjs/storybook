import { CoreBuilder, ProjectType } from 'storybook/internal/cli';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.VUE3,
    renderer: 'vue3',
  },
  configure: async () => {
    return {
      extraPackages: async ({ builder }) => {
        return builder === CoreBuilder.Webpack5
          ? ['vue-loader@^17.0.0', '@vue/compiler-sfc@^3.2.0']
          : [];
      },
      webpackCompiler: ({ builder }) => (builder === CoreBuilder.Webpack5 ? 'swc' : undefined),
    };
  },
});
