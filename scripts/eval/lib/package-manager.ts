/**
 * Shared package manager detection and dependency installation.
 *
 * Used by trial preparation and any other eval flows that need a
 * package-manager-aware install step.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { x } from 'tinyexec';
import type { Logger } from '../types.ts';

/** Detect the package manager from lock files in a directory. */
export function detectPackageManager(dir: string): string {
  if (existsSync(join(dir, 'pnpm-lock.yaml')) || existsSync(join(dir, 'pnpm-workspace.yaml')))
    return 'pnpm';
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))) return 'bun';
  return 'npm';
}

function getInstallArgs(pm: string, dir: string): [string, string[]] {
  switch (pm) {
    case 'pnpm':
      return ['pnpm', ['install', '--no-frozen-lockfile']];
    case 'yarn':
      return [
        'yarn',
        existsSync(join(dir, '.yarnrc.yml')) ? ['install', '--no-immutable'] : ['install'],
      ];
    case 'bun':
      return ['bun', ['install']];
    default:
      return ['npm', ['install', '--ignore-scripts']];
  }
}

/** Install dependencies using the detected package manager. */
export async function installDeps(
  dir: string,
  logger: Logger,
  env?: Record<string, string>
): Promise<void> {
  const pm = detectPackageManager(dir);
  const [cmd, args] = getInstallArgs(pm, dir);
  logger.logStep(`Installing with ${pm}...`);
  await x(cmd, args, {
    timeout: 300_000,
    nodeOptions: { cwd: dir, ...(env && { env: env as NodeJS.ProcessEnv }) },
  });
}
