import { CoreBuilder, ProjectType } from 'storybook/internal/cli';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.SVELTEKIT,
    renderer: 'svelte',
    framework: 'sveltekit',
    builderOverride: CoreBuilder.Vite,
  },
  configure: async () => {
    return {
      extensions: ['js', 'ts', 'svelte'],
      extraAddons: ['@storybook/addon-svelte-csf'],
    };
  },
});
