import { ProjectType } from 'storybook/internal/cli';
import { SupportedBuilder, SupportedRenderer } from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.SVELTEKIT,
    renderer: SupportedRenderer.SVELTE,
    framework: 'sveltekit',
    builderOverride: SupportedBuilder.VITE,
  },
  configure: async () => {
    return {
      extensions: ['js', 'ts', 'svelte'],
      extraAddons: ['@storybook/addon-svelte-csf'],
    };
  },
});
