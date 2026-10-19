import { ProjectType } from 'storybook/internal/cli';
import { logger } from 'storybook/internal/node-logger';
import { SupportedBuilder, SupportedRenderer } from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule.ts';
import { isRemix3VersionRange } from '../../services/ProjectTypeService.ts';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.HTML,
    renderer: SupportedRenderer.HTML,
  },
  configure: async () => {
    return {
      webpackCompiler: ({ builder }) => (builder === SupportedBuilder.WEBPACK5 ? 'swc' : undefined),
    };
  },
  postConfigure: ({ packageManager }) => {
    if (!isRemix3VersionRange(packageManager.getDependencyVersion('remix'))) {
      return;
    }

    logger.log('Remix 3 is set up with the HTML renderer (@storybook/html-vite).');
  },
});
