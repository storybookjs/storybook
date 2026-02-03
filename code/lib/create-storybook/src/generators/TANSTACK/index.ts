import { ProjectType } from 'storybook/internal/cli';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.TANSTACK,
    renderer: SupportedRenderer.REACT,
    framework: SupportedFramework.TANSTACK_REACT,
    builderOverride: SupportedBuilder.VITE,
  },
  configure: async () => {
    return {
      extraPackages: ['@tanstack/react-query', '@tanstack/react-router'],
    };
  },
});
