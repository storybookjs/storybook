import { csfFactories } from '../../codemod/csf-factories';
import type { CommandFix, Fix } from '../types';
import { addonA11yAddonTest } from './addon-a11y-addon-test';
import { addonA11yParameters } from './addon-a11y-parameters';
import { addonExperimentalTest } from './addon-experimental-test';
import { addonMdxGfmRemove } from './addon-mdx-gfm-remove';
import { addonStorysourceCodePanel } from './addon-storysource-code-panel';
import { consolidatedImports } from './consolidated-imports';
import { eslintPlugin } from './eslint-plugin';
import { initialGlobals } from './initial-globals';
import { removeAddonInteractions } from './remove-addon-interactions';
import { removeDocsAutodocs } from './remove-docs-autodocs';
import { removeEssentials } from './remove-essentials';
import { rendererToFramework } from './renderer-to-framework';
import { rnstorybookConfig } from './rnstorybook-config';
import { upgradeStorybookRelatedDependencies } from './upgrade-storybook-related-dependencies';
import { wrapRequire } from './wrap-require';

export * from '../types';

export const allFixes: Fix[] = [
  eslintPlugin,
  wrapRequire,
  addonMdxGfmRemove,
  addonStorysourceCodePanel,
  upgradeStorybookRelatedDependencies,
  initialGlobals,
  addonA11yAddonTest,
  consolidatedImports,
  addonExperimentalTest,
  rnstorybookConfig,
  removeAddonInteractions,
  rendererToFramework,
  removeEssentials,
  addonA11yParameters,
  removeDocsAutodocs,
];

export const initFixes: Fix[] = [eslintPlugin];

// These are specific fixes that only occur when triggered on command, and are hidden otherwise.
// e.g. npx storybook automigrate csf-factories
export const commandFixes: CommandFix[] = [csfFactories];
