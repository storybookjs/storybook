import type { JsPackageManager } from 'storybook/internal/common';
import { executeCommand, getProjectRoot, isCI, versions } from 'storybook/internal/common';
import { CLI_COLORS, logger, prompt } from 'storybook/internal/node-logger';
import { ExecaCommandFailedError } from 'storybook/internal/server-errors';
import { isTelemetryModuleEnabled } from 'storybook/internal/telemetry';

import { prerelease } from 'semver';

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
  refType?: 'tag' | 'branch';
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

async function resolveSkillsRef(
  storybookVersion: string
): Promise<{ ref: string; refType: 'tag' | 'branch' }> {
  const tag = `v${storybookVersion}`;
  try {
    const { stdout } = await executeCommand({
      command: 'git',
      args: ['ls-remote', '--tags', `https://github.com/${SKILLS_REPO}`, `refs/tags/${tag}`],
      stdio: 'pipe',
    });
    if (stdout.trim()) {
      return { ref: tag, refType: 'tag' };
    }
  } catch (error) {
    logger.debug(error);
  }
  return { ref: prerelease(storybookVersion) ? 'next' : 'main', refType: 'branch' };
}

/**
 * Install the official Storybook skills into the project's git root through Vercel's `skills`
 * CLI, remembering the answer per project in the global settings file. Never throws.
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
    isInteractive: !!process.stdout.isTTY,
    yes,
    agent,
    remembered: settings.value.agentSkills?.[projectRoot],
  });

  if (decision.action === 'ask') {
    const accepted = await prompt.confirm({
      message:
        'Install the official Storybook skills for AI agents (Claude Code, Codex, Cursor) into this project?',
      initialValue: true,
    });
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

  const { ref, refType } = await resolveSkillsRef(versions.storybook);
  const args = [
    'skills@latest',
    'add',
    `${SKILLS_REPO}#${ref}`,
    '-y',
    '-a',
    'claude-code',
    'universal',
    '--copy',
  ];
  const env: Record<string, string> = { npm_config_yes: 'true' };
  if (prerelease(versions.storybook) || !isTelemetryModuleEnabled()) {
    env.DISABLE_TELEMETRY = '1';
  }

  logger.log(CLI_COLORS.cta(packageManager.getRemoteRunCommand(args)));
  try {
    await packageManager.runPackageCommand({
      args,
      useRemotePkg: true,
      cwd: projectRoot,
      stdio: 'inherit',
      env,
    });
  } catch (error) {
    logger.warn('Could not install the Storybook skills, continuing without them.');
    logger.debug(error);
    return {
      result: 'failed',
      source: decision.source,
      refType,
      exitCode: error instanceof ExecaCommandFailedError ? error.data.exitCode : undefined,
    };
  }

  await remember(true);
  logger.log(
    `Skip this next time with --no-skills. Remove them with: ${packageManager.getRemoteRunCommand(['skills@latest', 'remove'])}`
  );
  return { result: 'installed', source: decision.source, refType };
}
