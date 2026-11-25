import {
  hasAddonVitest,
  hasStorybookSkills,
  installSkills,
  skipsSkillsInCI,
  supportsSkills,
} from 'storybook/internal/cli';
import { frameworkPackages, frameworkToRenderer } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { relative } from 'pathe';

import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
import { crossesVersionBoundary } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';
import { ANGULAR_VITE_PACKAGE, offersAngularViteMigration } from './angular-to-angular-vite.ts';

const introducedIn = '11.0.0';

// How to add the skills later. `automigrate` only finds a config folder that is `.storybook` in
// the working directory. On Angular the skills need angular-vite; moving to it changes the
// builder, so that is named as a condition, not as a step to take.
export const addSkillsCommand = ({
  afterAngularViteMigration,
  configDir = '.storybook',
}: { afterAngularViteMigration?: boolean; configDir?: string } = {}) => {
  const dir = relative(process.cwd(), configDir) || '.';
  const automigrate = (id: string) =>
    `npx storybook automigrate ${id}${dir === '.storybook' ? '' : ` --config-dir ${dir}`}`;
  return afterAngularViteMigration
    ? `${automigrate('skills')}, once the project uses ${ANGULAR_VITE_PACKAGE} (${automigrate('angular-to-angular-vite')})`
    : automigrate('skills');
};

export const skills: Fix<{ afterAngularViteMigration?: boolean }> = {
  id: 'skills',
  link: 'https://github.com/storybookjs/skills',

  prompt: () =>
    'Recommended: install the official Storybook skills for AI agents into this project, and add a section to AGENTS.md that tells agents when to use them',

  async check({ packageManager, mainConfig, beforeVersion, storybookVersion, requested }) {
    // `installSkills` skips CI anyway; returning here keeps the no-op out of the list and the report.
    if (skipsSkillsInCI()) {
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
    if (framework && supportsSkills(frameworkToRenderer[framework], framework)) {
      return {};
    }
    // Checks see the main config from before the upgrade, so an Angular project that can move to
    // `@storybook/angular-vite` in this upgrade is offered the skills too. This check must not read
    // through `files`: a recheck after the migration would then drop the fix without installing.
    return !requested && (await offersAngularViteMigration(packageManager, mainConfig))
      ? { afterAngularViteMigration: true }
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
      // This fix runs for one Storybook of the project.
      sawEveryStorybook: false,
    });
    // `installSkills` already warned how to install them later; the upgrade itself succeeded.
    if (install.result === 'failed') {
      return false;
    }
  },
};
