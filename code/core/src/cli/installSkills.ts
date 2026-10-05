import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot, isCI, versions } from 'storybook/internal/common';
import { CLI_COLORS, logger, prompt } from 'storybook/internal/node-logger';
import { isTelemetryModuleEnabled } from 'storybook/internal/telemetry';

import { globalSettings } from './globalSettings.ts';

const SKILLS_REPO = 'storybookjs/skills';

export type SkillsSource = 'flag' | 'ci' | 'settings' | 'agent' | 'yes' | 'prompt' | 'default';

export type SkillsDecision = {
  action: 'install' | 'skip' | 'ask';
  source: SkillsSource;
};

export type SkillsInstallResult = {
  result: 'installed' | 'declined' | 'skipped' | 'failed';
  source: SkillsSource;
  exitCode?: number;
};

/** Decide whether init or upgrade should install the official Storybook skills. */
export function decideSkillsInstall(input: {
  skillsFlag?: boolean;
  isCI: boolean;
  isInteractive: boolean;
  yes: boolean;
  agent: boolean;
  remembered?: boolean;
}): SkillsDecision {
  if (input.skillsFlag === true) {
    return { action: 'install', source: 'flag' };
  }
  if (input.skillsFlag === false) {
    return { action: 'skip', source: 'flag' };
  }
  if (input.isCI) {
    return { action: 'skip', source: 'ci' };
  }
  if (input.remembered === true) {
    return { action: 'install', source: 'settings' };
  }
  if (input.remembered === false) {
    return { action: 'skip', source: 'settings' };
  }
  if (input.agent) {
    return { action: 'install', source: 'agent' };
  }
  if (input.yes) {
    return { action: 'install', source: 'yes' };
  }
  return input.isInteractive
    ? { action: 'ask', source: 'prompt' }
    : { action: 'install', source: 'default' };
}

/**
 * Install the official Storybook skills into the project root through Vercel's `skills` CLI,
 * remembering the answer per project in the global settings file. A failed install is reported in
 * the result instead of thrown.
 */
export async function installSkills({
  packageManager,
  skillsFlag,
  yes = false,
  agent = false,
}: {
  packageManager: JsPackageManager;
  skillsFlag?: boolean;
  yes?: boolean;
  agent?: boolean;
}): Promise<SkillsInstallResult> {
  const projectRoot = getProjectRoot();
  const settings = await globalSettings();
  const remember = async (answer: boolean) => {
    if (settings.value.agentSkills?.[projectRoot] === answer) {
      return;
    }
    settings.value.agentSkills = { ...settings.value.agentSkills, [projectRoot]: answer };
    await settings.save();
  };

  const decision = decideSkillsInstall({
    skillsFlag,
    isCI: !!isCI(),
    isInteractive: !!process.stdout.isTTY && !!process.stdin.isTTY,
    yes,
    agent,
    remembered: settings.value.agentSkills?.[projectRoot],
  });

  if (decision.action === 'ask') {
    let canceled = false;
    const accepted = await prompt.confirm(
      {
        message: 'Install the official Storybook skills for AI agents into this project?',
        initialValue: true,
      },
      {
        onCancel: () => {
          canceled = true;
        },
      }
    );
    if (canceled) {
      return { result: 'declined', source: decision.source };
    }
    if (!accepted) {
      await remember(false);
      return { result: 'declined', source: decision.source };
    }
  }

  if (decision.action === 'skip') {
    if (decision.source === 'flag') {
      await remember(false);
    }
    return { result: 'skipped', source: decision.source };
  }

  const args = [
    'skills@latest',
    'add',
    `${SKILLS_REPO}#v${versions.storybook}`,
    '--yes',
    '--agent',
    'claude-code',
    'universal',
    '--copy',
  ];

  logger.log(CLI_COLORS.cta(packageManager.getRemoteRunCommand(args)));
  try {
    await packageManager.runPackageCommand({
      args,
      useRemotePkg: true,
      cwd: projectRoot,
      stdio: 'inherit',
      env: isTelemetryModuleEnabled() ? {} : { DISABLE_TELEMETRY: '1' },
      timeout: 120_000,
    });
  } catch (error) {
    logger.warn('Could not install the Storybook skills, continuing without them.');
    logger.debug(error);
    // pnpm and Yarn Berry failures arrive as package-install errors because the args contain `add`
    const exitCode = (error as { data?: { exitCode?: unknown } } | undefined)?.data?.exitCode;
    return {
      result: 'failed',
      source: decision.source,
      exitCode: typeof exitCode === 'number' ? exitCode : undefined,
    };
  }

  await remember(true);
  logger.log(
    `Skip this next time with --no-skills. Remove them with: ${packageManager.getRemoteRunCommand(['skills@latest', 'remove'])}`
  );
  return { result: 'installed', source: decision.source };
}
