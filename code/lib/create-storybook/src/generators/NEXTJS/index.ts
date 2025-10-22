import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ProjectType } from 'storybook/internal/cli';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.NEXTJS,
    renderer: SupportedRenderer.REACT,
    framework: SupportedFramework.NEXTJS,
    builderOverride: SupportedBuilder.WEBPACK5,
  },
  configure: async () => {
    let staticDir;

    if (existsSync(join(process.cwd(), 'public'))) {
      staticDir = 'public';
    }

    return {
      staticDir,
    };
  },
});
