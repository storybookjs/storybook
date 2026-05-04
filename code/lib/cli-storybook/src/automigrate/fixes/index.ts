import { csfFactories } from '../../codemod/csf-factories.ts';
import type { CommandFix, Fix } from '../types.ts';
import { addonA11yAddonTest } from './addon-a11y-addon-test.ts';
import { addonA11yParameters } from './addon-a11y-parameters.ts';
import { addonExperimentalTest } from './addon-experimental-test.ts';
import { addonGlobalsApi } from './addon-globals-api.ts';
import { addonMdxGfmRemove } from './addon-mdx-gfm-remove.ts';
import { addonStorysourceCodePanel } from './addon-storysource-code-panel.ts';
import { consolidatedImports } from './consolidated-imports.ts';
import { eslintPlugin } from './eslint-plugin.ts';
import { fixFauxEsmRequire } from './fix-faux-esm-require.ts';
import { initialGlobals } from './initial-globals.ts';
import { migrateAddonConsole } from './migrate-addon-console.ts';
import { nextjsToNextjsVite } from './nextjs-to-nextjs-vite.ts';
import { removeAddonInteractions } from './remove-addon-interactions.ts';
import { removeDocsAutodocs } from './remove-docs-autodocs.ts';
import { removeEssentials } from './remove-essentials.ts';
import { rendererToFramework } from './renderer-to-framework.ts';
import { rnOndeviceAddonsToDeviceAddons } from './rn-ondevice-addons-to-device-addons.ts';
import { rnstorybookConfig } from './rnstorybook-config.ts';
import { storybookPackageNameConflict } from './storybook-package-name-conflict.ts';
import { upgradeStorybookRelatedDependencies } from './upgrade-storybook-related-dependencies.ts';
import { wrapGetAbsolutePath } from './wrap-getAbsolutePath.ts';

export * from '../types.ts';

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
  rnOndeviceAddonsToDeviceAddons,
  migrateAddonConsole,
  nextjsToNextjsVite,
  removeAddonInteractions,
  rendererToFramework,
  removeEssentials,
  addonA11yParameters,
  removeDocsAutodocs,
  wrapGetAbsolutePath,
  fixFauxEsmRequire,
  storybookPackageNameConflict,
];

export const initFixes: Fix[] = [eslintPlugin];

// These are specific fixes that only occur when triggered on command, and are hidden otherwise.
// e.g. npx storybook automigrate csf-factories
export const commandFixes: CommandFix[] = [csfFactories];
