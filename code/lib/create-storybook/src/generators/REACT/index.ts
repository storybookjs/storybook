import { ProjectType } from 'storybook/internal/cli';
import { SupportedBuilder, SupportedLanguage, SupportedRenderer } from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule';

// Export as module
export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.REACT,
    renderer: SupportedRenderer.REACT,
  },
  configure: async (packageManager, { language }) => {
    const extraPackages = language === SupportedLanguage.JAVASCRIPT ? ['prop-types'] : [];

    return {
      extraPackages,
      webpackCompiler: ({ builder }) => (builder === SupportedBuilder.WEBPACK5 ? 'swc' : undefined),
    };
  },
});
