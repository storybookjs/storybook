import { findConfigFile } from 'storybook/internal/common';
import { loadConfig } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

const managerApiPackages = ['storybook/manager-api', '@storybook/manager-api'];

export const sidebarFilters: Fix = {
  id: 'sidebar-filters',
  promptType: 'notification',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#tag-filtering-api',

  async check({ configDir, files }) {
    if (!configDir) {
      return null;
    }
    const managerPath = findConfigFile('manager', configDir);
    if (!managerPath) {
      return null;
    }

    let code: string;
    try {
      code = await files.read(managerPath);
    } catch {
      return null;
    }
    if (!code.includes('filters')) {
      return null;
    }

    let manager;
    try {
      manager = loadConfig(code, managerPath).parse();
    } catch {
      return null;
    }
    const hasFilters = manager
      .callArguments({
        importedName: 'addons',
        methodName: 'setConfig',
        moduleNames: managerApiPackages,
      })
      .some((object) => object.get(['sidebar', 'filters']) !== undefined);

    return hasFilters ? {} : null;
  },

  prompt() {
    return `${picocolors.cyan('sidebar.filters')} was removed in Storybook 11. Replace it with ${picocolors.cyan('tags.<name>.hideFromSidebar')} or ${picocolors.cyan('setFilter')}. This is not automigrated.`;
  },
};
