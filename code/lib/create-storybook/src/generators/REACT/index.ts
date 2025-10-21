import {
  CoreBuilder,
  ProjectType,
  SupportedLanguage,
  detectLanguage,
} from 'storybook/internal/cli';

import { defineGeneratorModule } from '../modules/GeneratorModule';

// Export as module
export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.REACT,
    renderer: 'react',
  },
  configure: async (packageManager) => {
    // Add prop-types dependency if not using TypeScript
    const language = await detectLanguage(packageManager);
    const extraPackages = language === SupportedLanguage.JAVASCRIPT ? ['prop-types'] : [];

    return {
      extraPackages,
      webpackCompiler: ({ builder }) => (builder === CoreBuilder.Webpack5 ? 'swc' : undefined),
    };
  },
});
