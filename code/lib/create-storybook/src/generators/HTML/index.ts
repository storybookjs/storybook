import { ProjectType } from 'storybook/internal/cli';
import { SupportedRenderer } from 'storybook/internal/types';

import { SupportedBuilder } from '../../../../../core/src/types/modules/builders';
import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.HTML,
    renderer: SupportedRenderer.HTML,
  },
  configure: async () => {
    return {
      webpackCompiler: ({ builder }) => (builder === SupportedBuilder.WEBPACK5 ? 'swc' : undefined),
    };
  },
});
