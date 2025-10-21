import { CoreBuilder, ProjectType } from 'storybook/internal/cli';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.SOLID,
    renderer: 'solid',
    framework: 'solid',
    builderOverride: CoreBuilder.Vite,
  },
  configure: async () => {
    return {
      addComponents: false,
    };
  },
});
