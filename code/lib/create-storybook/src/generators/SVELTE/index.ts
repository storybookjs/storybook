import { ProjectType } from 'storybook/internal/cli';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.SVELTE,
    renderer: 'svelte',
  },
  configure: async () => {
    return {
      extensions: ['js', 'ts', 'svelte'],
      extraAddons: ['@storybook/addon-svelte-csf'],
    };
  },
});
