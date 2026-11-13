import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot, isCI, versions } from 'storybook/internal/common';
import { CLI_COLORS, logger } from 'storybook/internal/node-logger';
import { detectAgent, isTelemetryModuleEnabled } from 'storybook/internal/telemetry';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { type AgentInstructionsMode, addStorybookAgentInstructions } from './agentInstructions.ts';

const SKILLS_REPO = 'storybookjs/skills';

// Skills of 11.0 prereleases that the skills repository no longer has, so a refresh removes them.
const REMOVED_SKILLS = ['stories', 'ui-workflow'];

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

/**
 * Whether the skills step skips this run because it runs in CI. Coding agents set `CI=true` on
 * their own to avoid prompts, so a run that an agent started is not CI here: it is the agent's
 * project that would end up without the skills.
 */
export function skipsSkillsInCI(): boolean {
  return !!isCI() && !detectAgent();
}

/** The command that installs the skills, for messages that tell the user how to add them later. */
export const SKILLS_AUTOMIGRATE_COMMAND = 'npx storybook automigrate skills --yes';

/** The message for a run that skipped the skills because CI is set. */
export const skippedSkillsInCIMessage = (command = SKILLS_AUTOMIGRATE_COMMAND) =>
  `Skipped the Storybook skills for AI agents because CI is set. Add them with: ${command}`;

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
 * prerelease. Skips CI (see {@link skipsSkillsInCI}) unless `allowCI` is set, and a
 * failed install is reported in the result instead of thrown.
 */
export async function installSkills({
  packageManager,
  source,
  stdio = 'inherit',
  allowCI = false,
}: {
  packageManager: JsPackageManager;
  source: SkillsSource;
  /** `pipe` keeps the `skills` CLI output out of a running task log. */
  stdio?: 'inherit' | 'pipe';
  /** Install in CI too, because the caller already decided, for example on the user's request. */
  allowCI?: boolean;
}): Promise<SkillsInstallResult> {
  const skillsRef = `${SKILLS_REPO}#v${versions.storybook}`;
  if (!allowCI && skipsSkillsInCI()) {
    logger.log(
      source === 'refresh'
        ? `Did not update the Storybook skills because CI is set. Update them with: ${packageManager.getRemoteRunCommand(['skills@latest', 'add', skillsRef])}`
        : skippedSkillsInCIMessage()
    );
    return { result: 'skipped', source: 'ci' };
  }

  const removedSkills = (await getStorybookSkillNames()).filter((name) =>
    REMOVED_SKILLS.includes(name)
  );
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
  // The `stories` skill had no section yet. `ui-workflow` came with one, so a project without it
  // removed it.
  await addAgentInstructions(
    source === 'refresh' && !removedSkills.includes('stories') ? 'update' : 'install'
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

const listFiles = (files: string[]) =>
  new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(files);

async function addAgentInstructions(mode: AgentInstructionsMode): Promise<void> {
  try {
    const changes = await addStorybookAgentInstructions(getProjectRoot(), mode);
    const added = changes.filter(({ change }) => change === 'added').map(({ file }) => file);
    const updated = changes.filter(({ change }) => change === 'updated').map(({ file }) => file);
    if (added.length > 0) {
      logger.log(
        `Added a Storybook section to ${listFiles(added)} that tells agents when to use the skills. Storybook keeps it current on upgrade: remove its markers to keep your own edits, or remove the section to opt out of the workflow.`
      );
    }
    if (updated.length > 0) {
      logger.log(`Updated the Storybook section in ${listFiles(updated)}.`);
    }
  } catch (error) {
    logger.warn(
      mode === 'update'
        ? 'Could not update the Storybook section for agents in AGENTS.md.'
        : 'Could not add the Storybook section for agents to AGENTS.md.'
    );
    logger.debug(error);
  }
}

/**
 * Bring the section between Storybook's markers in `AGENTS.md` up to date without installing the
 * skills, for `storybook upgrade` in a project that got the skills from a plugin or by hand. Adds
 * nothing, and skips CI like {@link installSkills}.
 */
export async function refreshAgentInstructions(): Promise<void> {
  if (skipsSkillsInCI()) {
    return;
  }
  await addAgentInstructions('update');
}
