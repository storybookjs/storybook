import { CoreBuilder, ProjectType } from 'storybook/internal/cli';

import { defineGeneratorModule } from '../modules/GeneratorModule';

// Export as module
export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.SERVER,
    renderer: 'server',
    builderOverride: CoreBuilder.Webpack5,
  },
  configure: async () => {
    return {
      webpackCompiler: () => 'swc',
      extensions: ['json', 'yaml', 'yml'],
    };
  },
});
