import type { Fix } from '../types';

import { cra5 } from './cra5';
import { webpack5 } from './webpack5';
import { vue3 } from './vue3';
import { mdxgfm } from './mdx-gfm';
import { removeLegacyMDX1 } from './remove-legacymdx1';
import { eslintPlugin } from './eslint-plugin';
import { builderVite } from './builder-vite';
import { viteConfigFile } from './vite-config-file';
import { sbScripts } from './sb-scripts';
import { sbBinary } from './sb-binary';
import { newFrameworks } from './new-frameworks';
import { removedGlobalClientAPIs } from './remove-global-client-apis';
import { autodocsTrue } from './autodocs-true';
import { angularBuilders } from './angular-builders';
import { angularBuildersMultiproject } from './angular-builders-multiproject';
import { wrapRequire } from './wrap-require';
import { reactDocgen } from './react-docgen';
import { mdxToCSF } from './mdx-to-csf';
import { removeReactDependency } from './prompt-remove-react';
import { storyshotsMigration } from './storyshots-migration';
import { removeArgtypesRegex } from './remove-argtypes-regex';
import { webpack5CompilerSetup } from './webpack5-compiler-setup';
import { removeJestTestingLibrary } from './remove-jest-testing-library';
import { addonsAPI } from './addons-api';
import { mdx1to3 } from './mdx-1-to-3';
import { addonPostCSS } from './addon-postcss';
import { vta } from './vta';
import { upgradeStorybookRelatedDependencies } from './upgrade-storybook-related-dependencies';
import { autodocsTags } from './autodocs-tags';
import { initialGlobals } from './initial-globals';
import { missingStorybookDependencies } from './missing-storybook-dependencies';

export * from '../types';

export const allFixes: Fix[] = [
  missingStorybookDependencies,
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
  removeJestTestingLibrary,
  removeArgtypesRegex,
  removedGlobalClientAPIs,
  mdxgfm,
  mdxToCSF,
  autodocsTrue,
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
  autodocsTags,
  initialGlobals,
];

export const initFixes: Fix[] = [eslintPlugin];
