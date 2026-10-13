import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot, isCI, versions } from 'storybook/internal/common';
import { CLI_COLORS, logger } from 'storybook/internal/node-logger';
import { isTelemetryModuleEnabled } from 'storybook/internal/telemetry';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { addStorybookAgentInstructions } from './agentInstructions.ts';

const SKILLS_REPO = 'storybookjs/skills';

/**
 * Skills that the skills repository no longer has. `stories` became `ui-workflow` and
 * `component-docs` in 11.0, so projects that installed the skills from an 11.0 prerelease still
 * have it.
 */
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

/** The names of the installed skills that come from the official Storybook skills repository. */
async function getStorybookSkillNames(): Promise<string[]> {
  try {
    const lock: { skills?: Record<string, { source?: string }> } = JSON.parse(
      await readFile(join(getProjectRoot(), 'skills-lock.json'), 'utf8')
    );
    return Object.entries(lock.skills ?? {})
      .filter(([, skill]) => skill.source?.toLowerCase().includes(SKILLS_REPO))
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
 * A refresh leaves `AGENTS.md` alone, so a user who removed the section keeps it removed, unless it
 * replaces skills that the skills repository no longer has.
 *
 * Never runs in CI, and a failed install is reported in the result instead of thrown.
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
  if (source !== 'refresh' || removedSkills.length > 0) {
    await addAgentInstructions();
  }

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

async function addAgentInstructions(): Promise<void> {
  try {
    const files = await addStorybookAgentInstructions(getProjectRoot());
    if (files.length > 0) {
      logger.log(
        `Added a Storybook section to ${files.join(' and ')} that tells agents when to use the skills. Edit it to change when, or remove it to opt out.`
      );
    }
  } catch (error) {
    logger.warn('Could not add the Storybook section to AGENTS.md.');
    logger.debug(error);
  }
}
