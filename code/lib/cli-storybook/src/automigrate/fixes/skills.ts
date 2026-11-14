import {
  hasAddonVitest,
  hasStorybookSkills,
  installSkills,
  skipsSkillsInCI,
  supportsSkills,
} from 'storybook/internal/cli';
import { frameworkPackages, frameworkToRenderer } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
import { crossesVersionBoundary } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';
import { ANGULAR_VITE_PACKAGE, offersAngularViteMigration } from './angular-to-angular-vite.ts';

const introducedIn = '11.0.0';

// How to add the skills later. `automigrate skills` alone does not apply until the project uses
// angular-vite.
export const addSkillsCommand = (result?: { afterAngularViteMigration?: boolean }) =>
  result?.afterAngularViteMigration
    ? 'npx storybook automigrate angular-to-angular-vite --yes, and then npx storybook automigrate skills --yes'
    : 'npx storybook automigrate skills --yes';

// In real CI the skills are installed only on request. Coding agents set `CI=true` themselves, and
// `skipsSkillsInCI` does not count their runs.
const unlessSkippedInCI = <T extends { afterAngularViteMigration?: boolean }>(
  result: T,
  requested: boolean | undefined
): T | null => {
  if (requested || !skipsSkillsInCI()) {
    return result;
  }
  logger.warn(
    `Skipped the Storybook skills for AI agents because CI is set. Add them with: ${addSkillsCommand(result)}`
  );
  return null;
};

export const skills: Fix<{ afterAngularViteMigration?: boolean }> = {
  id: 'skills',
  link: 'https://github.com/storybookjs/skills',

  prompt: () =>
    'Install the official Storybook skills for AI agents into this project, and add a section to AGENTS.md that tells agents when to use them',

  async check({ packageManager, mainConfig, beforeVersion, storybookVersion, requested }) {
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
    if (framework && supportsSkills(frameworkToRenderer[framework], framework)) {
      return unlessSkippedInCI({}, requested);
    }
    // Checks see the main config from before the upgrade, so an Angular project that can move to
    // `@storybook/angular-vite` in this upgrade is offered the skills too. This check must not read
    // through `files`: a recheck after the migration would then drop the fix without installing.
    return !requested && (await offersAngularViteMigration(packageManager, mainConfig))
      ? unlessSkippedInCI({ afterAngularViteMigration: true }, requested)
      : null;
  },

  async run({ packageManager, result, mainConfig }) {
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
      testSupported: hasAddonVitest(mainConfig),
      // `check` already decided about CI.
      allowCI: true,
    });
    // `installSkills` already warned how to install them later; the upgrade itself succeeded.
    if (install.result === 'failed') {
      return false;
    }
  },
};
