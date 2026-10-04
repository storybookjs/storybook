import { hasStorybookSkills, installSkills, supportsAiFeatures } from 'storybook/internal/cli';
import {
  HandledError,
  frameworkPackages,
  frameworkToRenderer,
  isCI,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
import { crossesVersionBoundary } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';
import { ANGULAR_VITE_PACKAGE, offersAngularViteMigration } from './angular-to-angular-vite.ts';

const introducedIn = '11.0.0';

export const skills: Fix<{ afterAngularViteMigration?: boolean }> = {
  id: 'skills',
  link: 'https://github.com/storybookjs/skills',

  prompt: () => 'Install the official Storybook skills for AI agents into this project',

  async check({ packageManager, mainConfig, beforeVersion, storybookVersion, requested }) {
    // `installSkills` skips CI anyway; returning here keeps the no-op out of the list and the report.
    if (isCI()) {
      return null;
    }
    if (
      !requested &&
      !(beforeVersion && crossesVersionBoundary(beforeVersion, storybookVersion, introducedIn))
    ) {
      return null;
    }
    if (await hasStorybookSkills()) {
      return null;
    }
    const frameworkPackage = getFrameworkPackageName(mainConfig);
    const framework = frameworkPackage ? frameworkPackages[frameworkPackage] : undefined;
    if (framework && supportsAiFeatures(frameworkToRenderer[framework], framework)) {
      return {};
    }
    // Checks see the main config from before the upgrade, so an Angular project that can move to
    // `@storybook/angular-vite` in this upgrade is offered the skills too. This check must not read
    // through `files`: a recheck after the migration would then drop the fix without installing.
    return !requested && (await offersAngularViteMigration(packageManager, mainConfig))
      ? { afterAngularViteMigration: true }
      : null;
  },

  async run({ packageManager, result }) {
    // The skills live in the project root, which every Storybook of a monorepo shares.
    if (await hasStorybookSkills()) {
      return;
    }
    // The angular-vite migration runs before this fix and adds its package when it was selected.
    if (
      result.afterAngularViteMigration &&
      !packageManager.getAllDependencies()[ANGULAR_VITE_PACKAGE]
    ) {
      logger.warn(
        `The Storybook skills need ${ANGULAR_VITE_PACKAGE}, so they were not installed. Run \`npx storybook automigrate angular-to-angular-vite\` and then \`npx storybook automigrate skills\`.`
      );
      return false;
    }
    const install = await installSkills({
      packageManager,
      source: 'automigration',
      stdio: 'pipe',
    });
    if (install.result === 'failed') {
      throw new HandledError('Could not install the Storybook skills');
    }
  },
};
