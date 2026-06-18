import { getAddonNames } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { detectAgent } from 'storybook/internal/telemetry';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { add } from '../../add.ts';
import type { Fix } from '../types.ts';

const ADDON_MCP = '@storybook/addon-mcp';

export interface AddonMcpOptions {
  /** Name of the detected AI coding agent (e.g. `claude`, `cursor`), surfaced in the prompt. */
  agentName: string;
  /** Whether `@storybook/addon-mcp` is already configured, so we update rather than install. */
  isInstalled: boolean;
}

/**
 * When `storybook upgrade` is driven by an AI coding agent, install `@storybook/addon-mcp` — or, if
 * it is already configured, pull it up to its latest version. The addon exposes the running
 * Storybook to the agent over MCP, so an agent that just ran an upgrade is exactly the audience that
 * benefits from it. Humans never see this migration — `check` returns null unless std-env detects an
 * agent.
 */
export const addonMcp: Fix<AddonMcpOptions> = {
  id: 'addon-mcp',
  link: 'https://github.com/storybookjs/mcp',

  async check({ mainConfig }) {
    const agent = detectAgent();
    if (!agent) {
      return null;
    }

    const isInstalled = getAddonNames(mainConfig).some((addon) => addon.includes(ADDON_MCP));

    return { agentName: agent.name, isInstalled };
  },

  prompt() {
    return dedent`
      We detected this upgrade is running through an AI coding agent.
      We'll add or update ${picocolors.magenta(ADDON_MCP)} to the latest version so the agent can talk to your running Storybook over MCP for more accurate assistance.
    `;
  },

  async run({ result, packageManager, configDir, dryRun }) {
    if (dryRun) {
      return;
    }

    logger.log(
      `${result.isInstalled ? 'Updating' : 'Installing'} ${picocolors.magenta(ADDON_MCP)} to the latest version...`
    );
    // `add` resolves the latest published version for satellite addons and, when the addon is
    // already present, refreshes the dependency without duplicating it in the main config.
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
