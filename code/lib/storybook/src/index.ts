export { defineAddon, defineMain } from '@storybook/core';
export type {
  HookHandler,
  MainConfig,
  MainTypes,
  Storybook,
  StorybookConfig,
  StorybookFrameworks,
  StorybookHooks,
  StorybookAddon,
} from '@storybook/core';
// Pulls the server hook declarations into this entry's types; addons hook them by name.
export type { StaticOutputWriter } from './storybook/server/hooks.ts';
