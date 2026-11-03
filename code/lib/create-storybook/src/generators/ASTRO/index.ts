import { ProjectType } from 'storybook/internal/cli';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule.ts';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.ASTRO,
    renderer: SupportedRenderer.ASTRO,
    framework: SupportedFramework.ASTRO,
    builderOverride: SupportedBuilder.VITE,
  },
  configure: async () => {
    return {
      // @storybook-astro/framework does not depend on the builder, and ships no example stories.
      extraPackages: ['@storybook/builder-vite'],
      addComponents: false,
    };
  },
});
