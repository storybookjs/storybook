import { CoreBuilder, ProjectType } from 'storybook/internal/cli';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.WEB_COMPONENTS,
    renderer: 'web-components',
  },
  configure: async () => {
    return {
      extraPackages: ['lit'],
      webpackCompiler: ({ builder }) => (builder === CoreBuilder.Webpack5 ? 'swc' : undefined),
    };
  },
});
