import {
  hasStorybookSkills,
  installSkills,
  skipsSkillsInCI,
  supportsSkills,
} from 'storybook/internal/cli';
import { frameworkPackages, frameworkToRenderer } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
import { crossesVersionBoundary } from '../helpers/versionBoundary.ts';
import type { CheckOptions, Fix } from '../types.ts';
import { ANGULAR_VITE_PACKAGE, offersAngularViteMigration } from './angular-to-angular-vite.ts';

const introducedIn = '11.0.0';

type SkillsResult = { afterAngularViteMigration?: boolean };

export const skills: Fix<SkillsResult> = {
  id: 'skills',
  link: 'https://github.com/storybookjs/skills',

  prompt: () =>
    'Install the official Storybook skills for AI agents into this project, and add a section to AGENTS.md that tells agents when to use them',

  async check(options) {
    // Real CI gets the skills only on request; `upgrade` says that it skipped them. Coding agents
    // set `CI=true` themselves, and `skipsSkillsInCI` does not count their runs as CI.
    if (!options.requested && skipsSkillsInCI()) {
      return null;
    }
    return offersSkills(options);
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
      // `check` already decided about CI.
      allowCI: true,
    });
    // `installSkills` already warned how to install them later; the upgrade itself succeeded.
    if (install.result === 'failed') {
      return false;
    }
  },
};

/** Whether the `skills` automigration applies to this project, regardless of CI. */
export async function offersSkills({
  packageManager,
  mainConfig,
  beforeVersion,
  storybookVersion,
  requested,
}: Pick<
  CheckOptions,
  'packageManager' | 'mainConfig' | 'beforeVersion' | 'storybookVersion' | 'requested'
>): Promise<SkillsResult | null> {
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
    return {};
  }
  // Checks see the main config from before the upgrade, so an Angular project that can move to
  // `@storybook/angular-vite` in this upgrade is offered the skills too. This check must not read
  // through `files`: a recheck after the migration would then drop the fix without installing.
  return !requested && (await offersAngularViteMigration(packageManager, mainConfig))
    ? { afterAngularViteMigration: true }
    : null;
}
