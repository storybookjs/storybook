import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ProjectType } from 'storybook/internal/cli';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.NEXTJS,
    renderer: 'react',
    framework: 'nextjs',
  },
  configure: async () => {
    let staticDir;

    if (existsSync(join(process.cwd(), 'public'))) {
      staticDir = 'public';
    }

    // TODO: Add nextjs-vite support (prompt for it)

    return {
      staticDir,
    };
  },
});
