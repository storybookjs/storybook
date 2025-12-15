import { ProjectType } from 'storybook/internal/cli';
import { SupportedBuilder, SupportedRenderer } from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule';

// Export as module
export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.SERVER,
    renderer: SupportedRenderer.SERVER,
    builderOverride: SupportedBuilder.WEBPACK5,
  },
  configure: async () => {
    return {
      webpackCompiler: () => 'swc',
      extensions: ['json', 'yaml', 'yml'],
    };
  },
});
