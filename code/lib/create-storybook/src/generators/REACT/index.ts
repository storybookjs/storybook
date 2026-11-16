import { ProjectType } from 'storybook/internal/cli';
import { SupportedBuilder, SupportedRenderer } from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule.ts';

// Export as module
export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.REACT,
    renderer: SupportedRenderer.REACT,
  },
  configure: async () => {
    return {
      webpackCompiler: ({ builder }) => (builder === SupportedBuilder.WEBPACK5 ? 'swc' : undefined),
    };
  },
});
