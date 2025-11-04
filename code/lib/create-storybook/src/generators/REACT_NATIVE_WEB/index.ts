import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import {
  ProjectType,
  SupportedLanguage,
  cliStoriesTargetPath,
  detectLanguage,
} from 'storybook/internal/cli';
import { CLI_COLORS, logger } from 'storybook/internal/node-logger';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { defineGeneratorModule } from '../modules/GeneratorModule';

// Export as module
export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.REACT_NATIVE_WEB,
    renderer: SupportedRenderer.REACT,
    framework: SupportedFramework.REACT_NATIVE_WEB_VITE,
    builderOverride: SupportedBuilder.VITE,
  },
  configure: async (packageManager) => {
    // Add prop-types dependency if not using TypeScript
    const language = await detectLanguage(packageManager);
    const extraPackages = ['vite', 'react-native-web'];
    if (language === SupportedLanguage.JAVASCRIPT) {
      extraPackages.push('prop-types');
    }

    return {
      extraPackages,
    };
  },
  postConfigure: async () => {
    try {
      const targetPath = await cliStoriesTargetPath();
      const cssFiles = (await readdir(targetPath)).filter((f) => f.endsWith('.css'));
      await Promise.all(cssFiles.map((f) => rm(join(targetPath, f))));
    } catch {
      // Silent fail if CSS cleanup fails - not critical
    }
  },
});
