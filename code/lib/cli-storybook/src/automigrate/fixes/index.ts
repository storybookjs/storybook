import { csfFactories } from '../../codemod/csf-factories';
import type { CommandFix, Fix } from '../types';
import { addonA11yAddonTest } from './addon-a11y-addon-test';
import { addonExperimentalTest } from './addon-experimental-test';
import { addonPostCSS } from './addon-postcss';
import { addonsAPI } from './addons-api';
import { angularBuilders } from './angular-builders';
import { angularBuildersMultiproject } from './angular-builders-multiproject';
import { builderVite } from './builder-vite';
import { consolidatedImports } from './consolidated-imports';
import { cra5 } from './cra5';
import { eslintPlugin } from './eslint-plugin';
import { initialGlobals } from './initial-globals';
import { mdx1to3 } from './mdx-1-to-3';
import { mdxgfm } from './mdx-gfm';
import { mdxToCSF } from './mdx-to-csf';
import { newFrameworks } from './new-frameworks';
import { removeReactDependency } from './prompt-remove-react';
import { reactDocgen } from './react-docgen';
import { removeAddonInteractions } from './remove-addon-interactions';
import { removeArgtypesRegex } from './remove-argtypes-regex';
import { removedGlobalClientAPIs } from './remove-global-client-apis';
import { removeLegacyMDX1 } from './remove-legacymdx1';
import { rendererToFramework } from './renderer-to-framework';
import { rnstorybookConfig } from './rnstorybook-config';
import { sbBinary } from './sb-binary';
import { sbScripts } from './sb-scripts';
import { storyshotsMigration } from './storyshots-migration';
import { upgradeStorybookRelatedDependencies } from './upgrade-storybook-related-dependencies';
import { viteConfigFile } from './vite-config-file';
import { vta } from './vta';
import { vue3 } from './vue3';
import { webpack5 } from './webpack5';
import { webpack5CompilerSetup } from './webpack5-compiler-setup';
import { wrapRequire } from './wrap-require';

export * from '../types';

export const allFixes: Fix[] = [
  addonsAPI,
  newFrameworks,
  cra5,
  webpack5,
  vue3,
  addonPostCSS,
  viteConfigFile,
  eslintPlugin,
  builderVite,
  sbBinary,
  sbScripts,
  removeArgtypesRegex,
  removedGlobalClientAPIs,
  mdxgfm,
  mdxToCSF,
  angularBuildersMultiproject,
  angularBuilders,
  wrapRequire,
  reactDocgen,
  storyshotsMigration,
  removeReactDependency,
  removeLegacyMDX1,
  webpack5CompilerSetup,
  mdx1to3,
  upgradeStorybookRelatedDependencies,
  vta,
  initialGlobals,
  addonA11yAddonTest,
  consolidatedImports,
  addonExperimentalTest,
  rendererToFramework,
  rnstorybookConfig,
  removeAddonInteractions,
];

export const initFixes: Fix[] = [eslintPlugin];

// These are specific fixes that only occur when triggered on command, and are hidden otherwise.
// e.g. npx storybook automigrate csf-factories
export const commandFixes: CommandFix[] = [csfFactories];
