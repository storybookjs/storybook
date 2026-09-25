import { getAbsolutePathWrapperName, getAddonNames } from 'storybook/internal/common';
import { readConfig } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import { detectAgent } from 'storybook/internal/telemetry';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { add } from '../../add.ts';
import { updateMainConfig } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';
import { ensureGetAbsolutePathWrapper } from './wrap-getAbsolutePath.ts';

const ADDON_MCP = '@storybook/addon-mcp';

export type AddonMcpOptions =
  | { agentName: string; isInstalled: true }
  | {
      agentName: string;
      isInstalled: false;
      addGetAbsolutePathWrapper: boolean;
      isConfigTypescript: boolean;
    };

/**
 * When `storybook upgrade` is driven by an AI coding agent, install `@storybook/addon-mcp` — or, if
 * it is already configured, pull it up to its latest version. The addon exposes the running
 * Storybook to the agent over MCP, so an agent that just ran an upgrade is exactly the audience that
 * benefits from it. Humans never see this migration — `check` returns null unless std-env detects an
 * agent.
 */
export const addonMcp: Fix<AddonMcpOptions> = {
  id: 'addon-mcp',
  link: 'https://github.com/storybookjs/storybook/tree/next/code/addons/mcp',

  async check({ mainConfig, mainConfigPath, packageManager }) {
    const agent = detectAgent();
    if (!agent) {
      return null;
    }

    const isInstalled = getAddonNames(mainConfig).some((addon) => addon.includes(ADDON_MCP));

    if (isInstalled) {
      return { agentName: agent.name, isInstalled: true };
    }

    const isConfigTypescript =
      mainConfigPath?.endsWith('.ts') === true || mainConfigPath?.endsWith('.tsx') === true;
    const addGetAbsolutePathWrapper =
      mainConfigPath !== undefined &&
      packageManager.isStorybookInMonorepo() &&
      getAbsolutePathWrapperName(await readConfig(mainConfigPath)) === null;

    return {
      agentName: agent.name,
      isInstalled: false,
      addGetAbsolutePathWrapper,
      isConfigTypescript,
    };
  },

  prompt() {
    return dedent`
      We detected this upgrade is running through an AI coding agent.
      We'll add or update ${picocolors.magenta(ADDON_MCP)} to the latest version so the agent can talk to your running Storybook over MCP for more accurate assistance.
    `;
  },

  async run({ result, packageManager, configDir, mainConfigPath, dryRun }) {
    if (dryRun) {
      return;
    }

    logger.log(
      `${result.isInstalled ? 'Updating' : 'Installing'} ${picocolors.magenta(ADDON_MCP)} to the latest version...`
    );

    if (!result.isInstalled && result.addGetAbsolutePathWrapper) {
      await updateMainConfig({ mainConfigPath, dryRun: false }, (mainConfig) => {
        ensureGetAbsolutePathWrapper(mainConfig, result.isConfigTypescript);
      });
    }

    // `add` pins core packages (including @storybook/addon-mcp) to the matching Storybook
    // version from the versions map and, when the addon is already present, refreshes the
    // dependency without duplicating it in the main config.
    // skipInstall: the upgrade command runs a single dependency install after all automigrations.
    await add(ADDON_MCP, {
      configDir,
      packageManager: packageManager.type,
      skipInstall: true,
      skipPostinstall: true,
      yes: true,
    });
  },
};
