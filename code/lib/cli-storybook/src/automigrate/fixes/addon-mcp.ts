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
}

/**
 * When `storybook upgrade` is driven by an AI coding agent and `@storybook/addon-mcp` is not yet
 * configured, install it. The addon exposes the running Storybook to the agent over MCP, so an
 * agent that just ran an upgrade is exactly the audience that benefits from it. Humans never see
 * this migration — `check` returns null unless std-env detects an agent.
 */
export const addonMcp: Fix<AddonMcpOptions> = {
  id: 'addon-mcp',
  link: 'https://github.com/storybookjs/mcp',

  async check({ mainConfig }) {
    const agent = detectAgent();
    if (!agent) {
      return null;
    }

    const isAlreadyConfigured = getAddonNames(mainConfig).some((addon) =>
      addon.includes(ADDON_MCP)
    );
    if (isAlreadyConfigured) {
      return null;
    }

    return { agentName: agent.name };
  },

  prompt() {
    return dedent`
      We detected this upgrade is running through an AI coding agent.
      We'll install ${picocolors.magenta(ADDON_MCP)} so the agent can talk to your running Storybook over MCP for more accurate assistance.
    `;
  },

  async run({ packageManager, configDir, dryRun }) {
    if (dryRun) {
      return;
    }

    logger.log(`Installing ${picocolors.magenta(ADDON_MCP)}...`);
    await add(ADDON_MCP, {
      configDir,
      packageManager: packageManager.type,
      skipInstall: true,
      skipPostinstall: true,
      yes: true,
    });
  },
};
