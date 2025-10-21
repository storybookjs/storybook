import { CoreBuilder, ProjectType } from 'storybook/internal/cli';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.EMBER,
    renderer: 'ember',
    framework: 'ember',
    builderOverride: CoreBuilder.Webpack5,
  },
  configure: async () => {
    return {
      staticDir: 'dist',
    };
  },
});
