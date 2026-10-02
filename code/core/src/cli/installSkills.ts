import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot, isCI, versions } from 'storybook/internal/common';
import { CLI_COLORS, logger } from 'storybook/internal/node-logger';
import { isTelemetryModuleEnabled } from 'storybook/internal/telemetry';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

const SKILLS_REPO = 'storybookjs/skills';

export type SkillsSource = 'ai-feature' | 'installed' | 'agent' | 'yes' | 'prompt' | 'default';

export type SkillsInstallResult = {
  result: 'installed' | 'declined' | 'skipped' | 'failed';
  source: SkillsSource | 'ci';
  exitCode?: number;
};

/** Whether init and upgrade offer the AI features (skills and the setup prompt) for this project. */
export function supportsAiFeatures(
  renderer: SupportedRenderer | undefined,
  builder: SupportedBuilder | undefined,
  framework: SupportedFramework | null | undefined
): boolean {
  if (framework === SupportedFramework.REACT_NATIVE_WEB_VITE) {
    return false;
  }
  return renderer === SupportedRenderer.REACT && builder === SupportedBuilder.VITE;
}

/** Whether the project has skills from the official Storybook skills repository installed. */
export async function hasStorybookSkills(): Promise<boolean> {
  try {
    const lock: { skills?: Record<string, { source?: string }> } = JSON.parse(
      await readFile(join(getProjectRoot(), 'skills-lock.json'), 'utf8')
    );
    return Object.values(lock.skills ?? {}).some((skill) =>
      skill.source?.toLowerCase().includes(SKILLS_REPO)
    );
  } catch {
    return false;
  }
}

/**
 * Install the official Storybook skills into the project root through Vercel's `skills` CLI.
 *
 * Never runs in CI, and a failed install is reported in the result instead of thrown.
 */
export async function installSkills({
  packageManager,
  source,
}: {
  packageManager: JsPackageManager;
  source: SkillsSource;
}): Promise<SkillsInstallResult> {
  if (isCI()) {
    return { result: 'skipped', source: 'ci' };
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
      cwd: getProjectRoot(),
      stdio: 'inherit',
      env: isTelemetryModuleEnabled() ? {} : { DISABLE_TELEMETRY: '1' },
      timeout: 120_000,
    });
  } catch (error) {
    logger.warn(
      `Could not install the Storybook skills, continuing without them. Install them later with: ${packageManager.getRemoteRunCommand(['skills@latest', 'add', SKILLS_REPO])}`
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

  logger.log(
    `Remove the Storybook skills with: ${packageManager.getRemoteRunCommand(['skills@latest', 'remove'])}`
  );
  return { result: 'installed', source };
}
