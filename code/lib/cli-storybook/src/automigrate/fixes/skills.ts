import { hasStorybookSkills, installSkills, supportsAiFeatures } from 'storybook/internal/cli';
import {
  HandledError,
  frameworkPackages,
  frameworkToRenderer,
  isCI,
} from 'storybook/internal/common';

import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
import { crossesVersionBoundary } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';

const introducedIn = '11.0.0';

export const skills: Fix = {
  id: 'skills',
  link: 'https://github.com/storybookjs/skills',

  prompt: () => 'Install the official Storybook skills for AI agents into this project',

  async check({ mainConfig, beforeVersion, storybookVersion, requested }) {
    // The skills are never installed in CI.
    if (isCI()) {
      return null;
    }
    if (!requested) {
      if (
        !(beforeVersion && crossesVersionBoundary(beforeVersion, storybookVersion, introducedIn))
      ) {
        return null;
      }
      const frameworkPackage = getFrameworkPackageName(mainConfig);
      const framework = frameworkPackage ? frameworkPackages[frameworkPackage] : undefined;
      if (!framework || !supportsAiFeatures(frameworkToRenderer[framework], framework)) {
        return null;
      }
    }
    return (await hasStorybookSkills()) ? null : {};
  },

  async run({ packageManager }) {
    // The skills live in the project root, which every Storybook of a monorepo shares.
    if (await hasStorybookSkills()) {
      return;
    }
    const { result } = await installSkills({ packageManager, source: 'automigration' });
    if (result === 'failed') {
      throw new HandledError(
        'Could not install the Storybook skills. Try again with `npx storybook automigrate skills`.'
      );
    }
  },
};
