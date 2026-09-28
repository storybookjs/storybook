import { formatFileContent, HandledError } from 'storybook/internal/common';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';

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

export const transformSetConfigLayout = (
  source: string,
  managerConfigPath = '.storybook/manager.*'
) => {
  const managerConfig = loadConfig(source, managerConfigPath).parse();
  for (const object of managerConfig.callArguments({
    importedName: 'addons',
    methodName: 'setConfig',
    moduleNames: managerApiPackages,
  })) {
    for (const [group, names] of Object.entries(optionGroups)) {
      object.group([group], names);
    }
  }
  const [diagnostic] = managerConfig.mutationDiagnostics;
  if (diagnostic) {
    const location = diagnostic.loc?.start.line ? ` on line ${diagnostic.loc.start.line}` : '';
    throw new HandledError(
      `Cannot automigrate addons.setConfig in ${managerConfigPath}${location}: ${diagnostic.message}. Move top-level layout options into \`layout\` and \`enableShortcuts\` into \`ui\` manually. Keep nested values when an option exists in both places and retain expression evaluation order.`
    );
  }
  return managerConfig.changed ? formatConfig(managerConfig) : source;
};

export const setConfigLayout: Fix = {
  id: 'set-config-layout',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#top-level-setconfig-layout-and-ui-options-removed',

  prompt: () => 'Move top-level setConfig layout and UI options into their nested objects',

  transform: () => [
    {
      filter: { kind: ['manager'] },
      handler: (code, { id }) => {
        const transformed = transformSetConfigLayout(code, id);
        return transformed === code ? null : formatFileContent(id, transformed);
      },
    },
  ],
};
