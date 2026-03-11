import { ProjectType } from 'storybook/internal/cli';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.SOLID,
    renderer: SupportedRenderer.SOLID,
    framework: SupportedFramework.SOLID,
    builderOverride: SupportedBuilder.VITE,
  },
  configure: async () => {
    return {
      addComponents: true,
    };
  },
});
