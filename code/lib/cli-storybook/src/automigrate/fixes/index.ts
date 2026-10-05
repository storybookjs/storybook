import { csfFactories } from '../../codemod/csf-factories.ts';
import type { CommandFix, Fix } from '../types.ts';
import { angularToAngularVite } from './angular-to-angular-vite.ts';
import { angularViteRemoveCompodoc } from './angular-vite-remove-compodoc.ts';
import { csfNextMockedArgs } from './csf-next-mocked-args.ts';
import { argtypesDefaultValue } from './argtypes-default-value.ts';
import { componentSubtitle } from './component-subtitle.ts';
import { eslintPlugin } from './eslint-plugin.ts';
import { enableExperimentalDocgenServer } from './experimental-features.ts';
import { nextjsToNextjsVite } from './nextjs-to-nextjs-vite.ts';
import { reactViteToTanstackReact } from './react-vite-to-tanstack-react.ts';
import { removeExperimentalReview } from './remove-experimental-review.ts';
import { rnOndeviceAddonsToDeviceAddons } from './rn-ondevice-addons-to-device-addons.ts';
import { storybookPackageNameConflict } from './storybook-package-name-conflict.ts';
import { storySortToMain } from './story-sort-to-main.ts';
import { setConfigLayout } from './set-config-layout.ts';
import { sidebarFilters } from './sidebar-filters.ts';
import { skills } from './skills.ts';
import { tagFilterApi } from './tag-filter-api.ts';
import { upgradeStorybookRelatedDependencies } from './upgrade-storybook-related-dependencies.ts';
import { vitestSetupFile } from './vitest-setup-file.ts';
import { wrapGetAbsolutePath } from './wrap-getAbsolutePath.ts';

export * from '../types.ts';

export const allFixes: Fix[] = [
  eslintPlugin,
  upgradeStorybookRelatedDependencies,
  vitestSetupFile,
  componentSubtitle,
  argtypesDefaultValue,
  rnOndeviceAddonsToDeviceAddons,
  nextjsToNextjsVite,
  angularToAngularVite,
  angularViteRemoveCompodoc,
  reactViteToTanstackReact,
  wrapGetAbsolutePath,
  storybookPackageNameConflict,
  storySortToMain,
  setConfigLayout,
  tagFilterApi,
  sidebarFilters,
  csfNextMockedArgs,
  removeExperimentalReview,
  enableExperimentalDocgenServer,
  skills,
];

export const commandFixes: CommandFix[] = [csfFactories];
