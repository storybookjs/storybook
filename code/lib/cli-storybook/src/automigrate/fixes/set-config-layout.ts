import type { Fix } from '../types.ts';

const managerApiPackages = new Set(['storybook/manager-api', '@storybook/manager-api']);

const optionGroups = {
  layout: [
    'initialActive',
    'navSize',
    'bottomPanelHeight',
    'rightPanelWidth',
    'recentVisibleSizes',
    'panelPosition',
    'showNav',
    'showPanel',
    'showTabs',
    'showToolbar',
    'showMobileNavigation',
  ],
  ui: ['enableShortcuts'],
};

export const setConfigLayout: Fix = {
  id: 'set-config-layout',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#top-level-setconfig-layout-and-ui-options-removed',

  prompt: () => 'Move top-level setConfig layout and UI options into their nested objects',

  transform: () => [
    {
      filter: { kind: ['manager'] },
      editConfig: (manager) => {
        for (const object of manager.callArguments({
          importedName: 'addons',
          methodName: 'setConfig',
          moduleNames: managerApiPackages,
        })) {
          for (const [group, names] of Object.entries(optionGroups)) {
            object.group([group], names);
          }
        }
      },
    },
  ],
};
