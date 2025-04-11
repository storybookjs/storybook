import { csfFactories } from '../../codemod/csf-factories';
import type { CommandFix, Fix } from '../types';
import { addonA11yAddonTest } from './addon-a11y-addon-test';
import { addonEssentialsRemoveDocs } from './addon-essentials-remove-docs';
import { addonExperimentalTest } from './addon-experimental-test';
import { addonMdxGfmRemove } from './addon-mdx-gfm-remove';
import { addonStorysourceRemove } from './addon-storysource-remove';
import { consolidatedImports } from './consolidated-imports';
import { eslintPlugin } from './eslint-plugin';
import { initialGlobals } from './initial-globals';
import { removeAddonInteractions } from './remove-addon-interactions';
import { rendererToFramework } from './renderer-to-framework';
import { rnstorybookConfig } from './rnstorybook-config';
import { upgradeStorybookRelatedDependencies } from './upgrade-storybook-related-dependencies';
import { wrapRequire } from './wrap-require';

export * from '../types';

export const allFixes: Fix[] = [
  eslintPlugin,
  wrapRequire,
  addonMdxGfmRemove,
  addonStorysourceRemove,
  upgradeStorybookRelatedDependencies,
  initialGlobals,
  addonA11yAddonTest,
  consolidatedImports,
  addonExperimentalTest,
  rnstorybookConfig,
  removeAddonInteractions,
  rendererToFramework,
  addonEssentialsRemoveDocs,
];

export const initFixes: Fix[] = [eslintPlugin];

// These are specific fixes that only occur when triggered on command, and are hidden otherwise.
// e.g. npx storybook automigrate csf-factories
export const commandFixes: CommandFix[] = [csfFactories];
