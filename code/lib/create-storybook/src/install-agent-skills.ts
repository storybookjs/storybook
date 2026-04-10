import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { executeCommand } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

/**
 * Installs all Storybook agent skills using the Vercel skills CLI.
 *
 * Points `npx skills add` at the bundled `skills/` directory, which auto-discovers
 * every `SKILL.md` underneath. Adding a new skill is as simple as creating a new
 * `skills/<skill-name>/SKILL.md` file — no changes to this command needed.
 *
 * Uses symlink mode (default) so that updating Storybook automatically refreshes
 * the skill content via the symlink target in node_modules. The skills CLI handles
 * agent detection and file placement.
 *
 * The `skills/` directory ships with the `create-storybook` package. We resolve
 * its location via `require.resolve` so the path is correct regardless of which
 * package bundled this code — this file is inlined into both `create-storybook`
 * and `@storybook/cli` builds by the bundler.
 */
export async function installAgentSkills(): Promise<void> {
  const require = createRequire(import.meta.url);
  const createStorybookPkg = require.resolve('create-storybook/package.json');
  const skillsDir = join(dirname(createStorybookPkg), 'skills');

  try {
    // Silently pipe output on success; surface it only when the command fails.
    await executeCommand({
      command: 'npx',
      args: ['skills', 'add', skillsDir, '--skill', '*', '--yes'],
      stdio: 'pipe',
    });
  } catch (error) {
    // Non-critical — don't fail the init if skill installation fails.
    const message = error instanceof Error ? error.message : String(error);
    // execa attaches the subprocess's stderr/stdout to the error; include them so
    // users can see why the skills CLI failed.
    const stderr =
      error && typeof error === 'object' && 'stderr' in error ? String(error.stderr ?? '') : '';
    const stdout =
      error && typeof error === 'object' && 'stdout' in error ? String(error.stdout ?? '') : '';
    const details = [stderr, stdout].filter(Boolean).join('\n');

    logger.warn(`Could not install agent skills: ${message}${details ? `\n${details}` : ''}`);
  }
}
