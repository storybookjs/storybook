import { ProjectType } from 'storybook/internal/cli';
import { SupportedRenderer } from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.STENCIL,
    renderer: SupportedRenderer.STENCIL,
  },
  configure: async () => {
    return {
      extraPackages: ['@stencil/storybook-plugin'],
    };
  },
});
