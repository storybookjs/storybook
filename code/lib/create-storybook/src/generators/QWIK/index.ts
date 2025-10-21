import { ProjectType } from 'storybook/internal/cli';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.QWIK,
    renderer: 'qwik',
    framework: 'qwik',
  },
  configure: async () => {
    return {};
  },
});
