import {
  MIN_SUPPORTED_NODE_DESCRIPTION,
  MIN_SUPPORTED_NODE_VERSIONS,
  detectDeclaredNodeVersions,
  formatMinVersion,
  isNodeVersionSupported,
  parseNodeVersionString,
  updateEnginesNode,
  updateNvmrc,
} from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import { minVersion } from 'semver';
import { dedent } from 'ts-dedent';

/**
 * Handle the case where the user's Node.js runtime is below Storybook's minimum.
 *
 * Before exiting, checks for .nvmrc and engines.node and offers to bump them,
 * since the user is likely on an old Node because their project pins them to it.
 *
 * Always calls process.exit(1) at the end.
 */
export async function handleUnsupportedNodeRuntime(
  major: number,
  minor: number,
  patch: number
): Promise<void> {
  const runtimeVersion = `${major}.${minor}.${patch}`;
  const declared = detectDeclaredNodeVersions();

  const isInteractive =
    process.stdout.isTTY && process.stdin.isTTY && !process.env.CI && !process.env.STORYBOOK_CI;

  let nvmrcBumped: string | undefined;
  let enginesBumped: string | undefined;

  // Check .nvmrc
  if (isInteractive && declared.nvmrcPath && declared.nvmrcVersion) {
    const parsed = parseNodeVersionString(declared.nvmrcVersion);
    if (parsed && !isNodeVersionSupported(parsed.major, parsed.minor, parsed.patch)) {
      logger.warn(dedent`
        Your .nvmrc specifies Node.js ${declared.nvmrcVersion}, which is below Storybook's
        minimum supported version (${MIN_SUPPORTED_NODE_DESCRIPTION}).
      `);

      const selected = await promptBump('nvmrc');
      if (selected !== 'skip') {
        updateNvmrc(declared.nvmrcPath, selected);
        nvmrcBumped = selected;
      }
    }
  }

  // Check engines.node
  if (isInteractive && declared.enginesNode && declared.packageJsonPath) {
    const min = minVersion(declared.enginesNode);
    if (min && !isNodeVersionSupported(min.major, min.minor, min.patch)) {
      logger.warn(dedent`
        Your package.json engines.node ("${declared.enginesNode}") resolves to a minimum of
        Node.js ${min.version}, which is below Storybook's minimum supported version
        (${MIN_SUPPORTED_NODE_DESCRIPTION}).
      `);

      const selected = await promptBump('engines');
      if (selected !== 'skip') {
        updateEnginesNode(declared.packageJsonPath, selected);
        enginesBumped = selected;
      }
    }
  }

  // Show context-aware exit message
  if (nvmrcBumped && enginesBumped) {
    logger.error(dedent`
      To run Storybook, you need Node.js version ${MIN_SUPPORTED_NODE_DESCRIPTION}.
      You are currently running Node.js v${runtimeVersion}.

      Your .nvmrc has been updated to ${nvmrcBumped} and your package.json engines.node has been updated to "${enginesBumped}".
      Switch to a supported Node.js version and re-run:
        nvm use
        npx storybook@latest init
    `);
  } else if (nvmrcBumped) {
    logger.error(dedent`
      To run Storybook, you need Node.js version ${MIN_SUPPORTED_NODE_DESCRIPTION}.
      You are currently running Node.js v${runtimeVersion}.

      Your .nvmrc has been updated to ${nvmrcBumped}. Switch to it and re-run:
        nvm use
        npx storybook@latest init
    `);
  } else if (enginesBumped) {
    logger.error(dedent`
      To run Storybook, you need Node.js version ${MIN_SUPPORTED_NODE_DESCRIPTION}.
      You are currently running Node.js v${runtimeVersion}.

      Your package.json engines.node has been updated to "${enginesBumped}".
      Please switch to a supported Node.js version and re-run:
        npx storybook@latest init
    `);
  } else {
    logger.error(dedent`
      To run Storybook, you need Node.js version ${MIN_SUPPORTED_NODE_DESCRIPTION}.
      You are currently running Node.js v${runtimeVersion}. Please upgrade and re-run.
    `);
  }

  process.exit(1);
}

async function promptBump(type: 'nvmrc' | 'engines'): Promise<string> {
  const options: Array<{ value: string; label: string }> = MIN_SUPPORTED_NODE_VERSIONS.map((v) => ({
    value: type === 'nvmrc' ? `${v.major}.${v.minor}.${v.patch}` : `>=${v.major}.${v.minor}`,
    label: formatMinVersion(v).replace('+', ''),
  }));

  options.push({ value: 'skip', label: "Don't change" });

  const message =
    type === 'nvmrc'
      ? 'Update your .nvmrc to a supported version?'
      : 'Update your package.json engines.node to a supported version?';

  return prompt.select<string>({ message, options });
}
