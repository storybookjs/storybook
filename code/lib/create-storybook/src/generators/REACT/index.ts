import { ProjectType, SupportedLanguage, detectLanguage } from 'storybook/internal/cli';
import { SupportedBuilder, SupportedRenderer } from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule';

// Export as module
export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.REACT,
    renderer: SupportedRenderer.REACT,
  },
  configure: async (packageManager) => {
    // Add prop-types dependency if not using TypeScript
    const language = await detectLanguage(packageManager);
    const extraPackages = language === SupportedLanguage.JAVASCRIPT ? ['prop-types'] : [];

    return {
      extraPackages,
      webpackCompiler: ({ builder }) => (builder === SupportedBuilder.WEBPACK5 ? 'swc' : undefined),
    };
  },
});
