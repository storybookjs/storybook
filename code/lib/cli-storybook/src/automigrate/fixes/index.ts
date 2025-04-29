import { csfFactories } from '../../codemod/csf-factories';
import type { CommandFix, Fix } from '../types';
import { addonA11yAddonTest } from './addon-a11y-addon-test';
import { addonA11yParameters } from './addon-a11y-parameters';
import { addonEssentialsRemoveDocs } from './addon-essentials-remove-docs';
import { addonExperimentalTest } from './addon-experimental-test';
import { addonMdxGfmRemove } from './addon-mdx-gfm-remove';
import { addonStorysourceRemove } from './addon-storysource-remove';
import { consolidatedImports } from './consolidated-imports';
import { eslintPlugin } from './eslint-plugin';
import { initialGlobals } from './initial-globals';
import { removeAddonInteractions } from './remove-addon-interactions';
import { removeDocsAutodocs } from './remove-docs-autodocs';
import { rendererToFramework } from './renderer-to-framework';
import { rnstorybookConfig } from './rnstorybook-config';
import { upgradeStorybookRelatedDependencies } from './upgrade-storybook-related-dependencies';
import { wrapRequire } from './wrap-require';

export * from '../types';

export const allFixes = [
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
  addonA11yParameters,
  removeDocsAutodocs,
] satisfies Fix[];

export type FixesIDs<F extends Fix[]> = F[number]['id'];

export const initFixes = [eslintPlugin] satisfies Fix[];

// These are specific fixes that only occur when triggered on command, and are hidden otherwise.
// e.g. npx storybook automigrate csf-factories
export const commandFixes = [csfFactories] satisfies CommandFix[];
