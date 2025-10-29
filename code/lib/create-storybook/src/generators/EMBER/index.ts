import { ProjectType } from 'storybook/internal/cli';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.EMBER,
    renderer: SupportedRenderer.EMBER,
    framework: SupportedFramework.EMBER,
  },
  configure: async () => {
    return {
      extensions: ['js', 'ts', 'gts', 'gjs'],
    };
  },
});
