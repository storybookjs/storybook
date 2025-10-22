import { ProjectType } from 'storybook/internal/cli';
import { SupportedRenderer } from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.SVELTE,
    renderer: SupportedRenderer.SVELTE,
  },
  configure: async () => {
    return {
      extensions: ['js', 'ts', 'svelte'],
      extraAddons: ['@storybook/addon-svelte-csf'],
    };
  },
});
