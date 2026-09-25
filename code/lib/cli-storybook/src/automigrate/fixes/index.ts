import { csfFactories } from '../../codemod/csf-factories.ts';
import type { CommandFix, Fix } from '../types.ts';
import { addonA11yAddonTest } from './addon-a11y-addon-test.ts';
import { angularToAngularVite } from './angular-to-angular-vite.ts';
import { angularViteRemoveCompodoc } from './angular-vite-remove-compodoc.ts';
import { addonMcp } from './addon-mcp.ts';
import { componentSubtitle } from './component-subtitle.ts';
import { eslintPlugin } from './eslint-plugin.ts';
import {
  enableExperimentalDocgenServer,
  enableExperimentalReview,
} from './experimental-features.ts';
import { nextjsToNextjsVite } from './nextjs-to-nextjs-vite.ts';
import { reactViteToTanstackReact } from './react-vite-to-tanstack-react.ts';
import { rnOndeviceAddonsToDeviceAddons } from './rn-ondevice-addons-to-device-addons.ts';
import { storybookPackageNameConflict } from './storybook-package-name-conflict.ts';
import { setConfigLayout } from './set-config-layout.ts';
import { upgradeStorybookRelatedDependencies } from './upgrade-storybook-related-dependencies.ts';
import { vitestSetupFile } from './vitest-setup-file.ts';
import { wrapGetAbsolutePath } from './wrap-getAbsolutePath.ts';

export * from '../types.ts';

export const allFixes: Fix[] = [
  eslintPlugin,
  upgradeStorybookRelatedDependencies,
  addonA11yAddonTest,
  vitestSetupFile,
  componentSubtitle,
  rnOndeviceAddonsToDeviceAddons,
  nextjsToNextjsVite,
  angularToAngularVite,
  angularViteRemoveCompodoc,
  reactViteToTanstackReact,
  addonMcp,
  wrapGetAbsolutePath,
  storybookPackageNameConflict,
  setConfigLayout,
  enableExperimentalReview,
  enableExperimentalDocgenServer,
];

export const initFixes: Fix[] = [eslintPlugin];

// These are specific fixes that only occur when triggered on command, and are hidden otherwise.
// e.g. npx storybook automigrate csf-factories
export const commandFixes: CommandFix[] = [csfFactories];
