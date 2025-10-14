import { csfFactories } from '../../codemod/csf-factories';
import type { CommandFix, Fix } from '../types';
import { addonA11yAddonTest } from './addon-a11y-addon-test';
import { addonA11yParameters } from './addon-a11y-parameters';
import { addonExperimentalTest } from './addon-experimental-test';
import { addonGlobalsApi } from './addon-globals-api';
import { addonMdxGfmRemove } from './addon-mdx-gfm-remove';
import { addonStorysourceCodePanel } from './addon-storysource-code-panel';
import { consolidatedImports } from './consolidated-imports';
import { eslintPlugin } from './eslint-plugin';
import { fixFauxEsmRequire } from './fix-faux-esm-require';
import { initialGlobals } from './initial-globals';
import { migrateAddonConsole } from './migrate-addon-console';
import { removeAddonInteractions } from './remove-addon-interactions';
import { removeDocsAutodocs } from './remove-docs-autodocs';
import { removeEssentials } from './remove-essentials';
import { rendererToFramework } from './renderer-to-framework';
import { rnstorybookConfig } from './rnstorybook-config';
import { upgradeStorybookRelatedDependencies } from './upgrade-storybook-related-dependencies';
import { wrapGetAbsolutePath } from './wrap-getAbsolutePath';

export * from '../types';

export const allFixes: Fix[] = [
  eslintPlugin,
  addonMdxGfmRemove,
  addonStorysourceCodePanel,
  upgradeStorybookRelatedDependencies,
  initialGlobals,
  addonGlobalsApi,
  addonA11yAddonTest,
  consolidatedImports,
  addonExperimentalTest,
  rnstorybookConfig,
  migrateAddonConsole,
  removeAddonInteractions,
  rendererToFramework,
  removeEssentials,
  addonA11yParameters,
  removeDocsAutodocs,
  wrapGetAbsolutePath,
  fixFauxEsmRequire,
];

export const initFixes: Fix[] = [eslintPlugin];

// These are specific fixes that only occur when triggered on command, and are hidden otherwise.
// e.g. npx storybook automigrate csf-factories
export const commandFixes: CommandFix[] = [csfFactories];
