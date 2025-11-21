import { ProjectType } from 'storybook/internal/cli';
import { SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.QWIK,
    renderer: SupportedRenderer.QWIK,
    framework: SupportedFramework.QWIK,
  },
  configure: async () => {
    return {};
  },
});
