import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot, isCI, versions } from 'storybook/internal/common';
import { CLI_COLORS, logger } from 'storybook/internal/node-logger';
import { isTelemetryModuleEnabled } from 'storybook/internal/telemetry';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { type AgentInstructionsMode, addStorybookAgentInstructions } from './agentInstructions.ts';

const SKILLS_REPO = 'storybookjs/skills';

// Skills of 11.0 prereleases that the skills repository no longer has, so a refresh removes them.
const REMOVED_SKILLS = ['stories'];

export type SkillsSource = 'ai-feature' | 'refresh' | 'automigration';

export type SkillsInstallResult = {
  result: 'installed' | 'skipped' | 'failed';
  source: SkillsSource | 'ci';
  exitCode?: number;
};

/**
 * Whether init and upgrade offer the skills for this project: the frameworks that have, or are
 * getting, a docgen server for the docs workflow of the skills.
 */
export function supportsSkills(
  renderer: SupportedRenderer | undefined,
  framework: SupportedFramework | null | undefined
): boolean {
  // React Native reports the React renderer without a framework, and has no docgen provider.
  if (!framework) {
    return false;
  }
  return (
    renderer === SupportedRenderer.REACT ||
    renderer === SupportedRenderer.SVELTE ||
    renderer === SupportedRenderer.WEB_COMPONENTS ||
    framework === SupportedFramework.VUE3_VITE ||
    framework === SupportedFramework.ANGULAR_VITE
  );
}

/** Whether `storybook skills setup` supports this project, so init can print its prompt. */
export function supportsAiSetup(
  renderer: SupportedRenderer | undefined,
  builder: SupportedBuilder | undefined,
  framework: SupportedFramework | null | undefined
): boolean {
  if (framework === SupportedFramework.REACT_NATIVE_WEB_VITE || builder !== SupportedBuilder.VITE) {
    return false;
  }
  return (
    renderer === SupportedRenderer.REACT ||
    renderer === SupportedRenderer.VUE3 ||
    renderer === SupportedRenderer.ANGULAR
  );
}

// Matches the repository in any form the lock records (`owner/repo`, a URL, or an SSH remote), but
// not a fork with a longer name such as `storybookjs/skills-fork`.
const isSkillsRepo = (source: string) =>
  /(^|[/:])storybookjs\/skills(\.git)?\/?(#.*)?$/i.test(source);

async function getStorybookSkillNames(): Promise<string[]> {
  try {
    const lock: { skills?: Record<string, { source?: string }> } = JSON.parse(
      await readFile(join(getProjectRoot(), 'skills-lock.json'), 'utf8')
    );
    return Object.entries(lock.skills ?? {})
      .filter(([, skill]) => skill.source !== undefined && isSkillsRepo(skill.source))
      .map(([name]) => name);
  } catch {
    return [];
  }
}

/** Whether the project has skills from the official Storybook skills repository installed. */
export async function hasStorybookSkills(): Promise<boolean> {
  return (await getStorybookSkillNames()).length > 0;
}

/**
 * Install the official Storybook skills into the project root through Vercel's `skills` CLI, and
 * add the section that tells agents when to use them to `AGENTS.md`.
 *
 * A refresh only updates a section that still has Storybook's markers, so a section without them
 * and a removed section stay that way, unless the refresh replaces the `stories` skill of an 11.0
 * prerelease. Never runs in CI, and a failed install is reported in the result instead of thrown.
 */
export async function installSkills({
  packageManager,
  source,
  stdio = 'inherit',
}: {
  packageManager: JsPackageManager;
  source: SkillsSource;
  /** `pipe` keeps the `skills` CLI output out of a running task log. */
  stdio?: 'inherit' | 'pipe';
}): Promise<SkillsInstallResult> {
  if (isCI()) {
    return { result: 'skipped', source: 'ci' };
  }

  const removedSkills = (await getStorybookSkillNames()).filter((name) =>
    REMOVED_SKILLS.includes(name)
  );
  const skillsRef = `${SKILLS_REPO}#v${versions.storybook}`;
  const args = [
    'skills@latest',
    'add',
    skillsRef,
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
      cwd: getProjectRoot(),
      stdio,
      env: isTelemetryModuleEnabled() ? {} : { DISABLE_TELEMETRY: '1' },
      timeout: 120_000,
    });
  } catch (error) {
    logger.warn(
      `Could not install the Storybook skills, continuing without them. Install them later with: ${packageManager.getRemoteRunCommand(['skills@latest', 'add', skillsRef])}`
    );
    logger.debug(error);
    // pnpm and Yarn Berry failures arrive as package-install errors because the args contain `add`
    const exitCode = (error as { data?: { exitCode?: unknown } } | undefined)?.data?.exitCode;
    return {
      result: 'failed',
      source,
      exitCode: typeof exitCode === 'number' ? exitCode : undefined,
    };
  }

  if (removedSkills.length > 0) {
    await removeSkills(packageManager, removedSkills, stdio);
  }
  await addAgentInstructions(
    source === 'refresh' && removedSkills.length === 0 ? 'update' : 'install'
  );

  logger.log(
    `Remove the Storybook skills with: ${packageManager.getRemoteRunCommand(['skills@latest', 'remove'])}`
  );
  return { result: 'installed', source };
}

async function removeSkills(
  packageManager: JsPackageManager,
  names: string[],
  stdio: 'inherit' | 'pipe'
): Promise<void> {
  const args = ['skills@latest', 'remove', ...names, '--yes'];
  try {
    await packageManager.runPackageCommand({
      args,
      useRemotePkg: true,
      cwd: getProjectRoot(),
      stdio,
      env: isTelemetryModuleEnabled() ? {} : { DISABLE_TELEMETRY: '1' },
      timeout: 120_000,
    });
  } catch (error) {
    logger.warn(
      `Could not remove the replaced Storybook skills ${names.join(', ')}. Remove them with: ${packageManager.getRemoteRunCommand(args)}`
    );
    logger.debug(error);
  }
}

async function addAgentInstructions(mode: AgentInstructionsMode): Promise<void> {
  try {
    const changes = await addStorybookAgentInstructions(getProjectRoot(), mode);
    const added = changes.filter(({ change }) => change === 'added').map(({ file }) => file);
    const updated = changes.filter(({ change }) => change === 'updated').map(({ file }) => file);
    if (added.length > 0) {
      logger.log(
        `Added a Storybook section to ${added.join(' and ')} that tells agents when to use the skills. Remove its markers to edit it, or remove the section to opt out.`
      );
    }
    if (updated.length > 0) {
      logger.log(`Updated the Storybook section in ${updated.join(' and ')}.`);
    }
  } catch (error) {
    logger.warn('Could not add the Storybook section for agents to AGENTS.md.');
    logger.debug(error);
  }
}
