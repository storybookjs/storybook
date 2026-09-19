import { readFile, writeFile } from 'node:fs/promises';

import { findConfigFile, formatFileContent, HandledError } from 'storybook/internal/common';
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

interface SetConfigLayoutOptions {
  managerConfigPath: string;
  transformedSource: string;
}

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

export const setConfigLayout: Fix<SetConfigLayoutOptions> = {
  id: 'set-config-layout',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#top-level-setconfig-layout-and-ui-options-removed',

  async check({ configDir }) {
    if (!configDir) {
      return null;
    }
    const managerConfigPath = findConfigFile('manager', configDir);
    if (!managerConfigPath) {
      return null;
    }

    const source = await readFile(managerConfigPath, 'utf8');
    const transformedSource = transformSetConfigLayout(source, managerConfigPath);
    return transformedSource === source ? null : { managerConfigPath, transformedSource };
  },

  prompt: () => 'Move top-level setConfig layout and UI options into their nested objects',

  async run({ dryRun, result }) {
    if (!dryRun) {
      await writeFile(
        result.managerConfigPath,
        await formatFileContent(result.managerConfigPath, result.transformedSource)
      );
    }
  },
};
