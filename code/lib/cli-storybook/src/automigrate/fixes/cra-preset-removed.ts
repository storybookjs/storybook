import { getAddonNames } from 'storybook/internal/common';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

type CraPresetRemovedResult = true;

/**
 * Notifies projects that still list `@storybook/preset-create-react-app` in their addons that
 * Create React App support has been removed. The builder no longer treats the preset specially,
 * so the addon silently has no effect; the warning replaces that silence with guidance.
 */
export const craPresetRemoved: Fix<CraPresetRemovedResult> = {
  id: 'cra-preset-removed',
  promptType: 'notification',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#create-react-app-support-removed',

  async check({ mainConfig }) {
    const hasCraPreset = getAddonNames(mainConfig).includes('@storybook/preset-create-react-app');

    return hasCraPreset ? true : null;
  },

  prompt() {
    return `Create React App support has been removed and ${picocolors.cyan(
      '@storybook/preset-create-react-app'
    )} no longer has any effect. Remove it from your ${picocolors.cyan(
      'addons'
    )} and migrate your project to Vite: https://storybook.js.org/docs/get-started/frameworks/react-vite`;
  },
};
