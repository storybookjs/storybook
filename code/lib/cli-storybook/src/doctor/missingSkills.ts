import {
  hasStorybookAgentInstructions,
  hasStorybookSkills,
  supportsSkills,
} from 'storybook/internal/cli';
import { frameworkPackages, frameworkToRenderer, getProjectRoot } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { coerce, major } from 'semver';

import { getFrameworkPackageName } from '../automigrate/helpers/mainConfigFile.ts';

// An upgrade within Storybook 11 does not offer the skills again, because someone may have removed
// them on purpose. Doctor says once per run that they are missing and how to add them.
export async function getMissingSkillsMessage(
  mainConfig: StorybookConfigRaw | undefined,
  storybookVersion: string | undefined
): Promise<string | undefined> {
  const version = coerce(storybookVersion);
  if (!mainConfig || !version || major(version) < 11) {
    return undefined;
  }
  const frameworkPackage = getFrameworkPackageName(mainConfig);
  const framework = frameworkPackage ? frameworkPackages[frameworkPackage] : undefined;
  if (!framework || !supportsSkills(frameworkToRenderer[framework], framework)) {
    return undefined;
  }
  // Skills from a plugin or added by hand have no lock entry, but come with Storybook's section.
  if ((await hasStorybookSkills()) || (await hasStorybookAgentInstructions(getProjectRoot()))) {
    return undefined;
  }
  return 'This project has no Storybook skills for AI agents. Add them with: npx storybook automigrate skills --yes';
}
