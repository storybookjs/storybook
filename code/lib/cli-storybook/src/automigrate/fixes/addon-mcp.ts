import { getAddonNames } from 'storybook/internal/common';
import { loadConfig } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import { detectAgent } from 'storybook/internal/telemetry';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { add } from '../../add.ts';
import type { Fix } from '../types.ts';

const ADDON_MCP = '@storybook/addon-mcp';

// Only an agent running the upgrade benefits from the addon, so humans never see this fix.
export const addonMcp: Fix = {
  id: 'addon-mcp',
  link: 'https://github.com/storybookjs/storybook/tree/next/code/addons/mcp',

  async check({ mainConfig, mainConfigPath, files }) {
    if (!detectAgent()) {
      return null;
    }

    // An optional addon: skip a main config that `add` could not edit, such as one that spreads a
    // shared config or exports a factory call, instead of failing the migration.
    const isInstalled = getAddonNames(mainConfig).some((addon) => addon.includes(ADDON_MCP));
    if (!isInstalled && mainConfigPath) {
      const main = loadConfig(await files.read(mainConfigPath), mainConfigPath).parse();
      main.appendValueToArray(['addons'], ADDON_MCP);
      if (main.mutationDiagnostics.length > 0) {
        logger.debug(
          `Skipping ${ADDON_MCP} in ${mainConfigPath}: ${main.mutationDiagnostics[0].message}`
        );
        return null;
      }
    }

    return {};
  },

  prompt() {
    return dedent`
      We detected this upgrade is running through an AI coding agent.
      We'll add or update ${picocolors.magenta(ADDON_MCP)} to the latest version so the agent can talk to your running Storybook over MCP for more accurate assistance.
    `;
  },

  async run({ packageManager, configDir }) {
    // `add` also refreshes an already-configured addon without duplicating it in main config.
    await add(ADDON_MCP, {
      configDir,
      packageManager: packageManager.type,
      skipInstall: true,
      skipPostinstall: true,
      yes: true,
    });
  },
};
