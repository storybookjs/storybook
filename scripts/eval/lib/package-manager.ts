/**
 * Shared package manager detection and dependency installation.
 *
 * Used by trial preparation and any other eval flows that need a
 * package-manager-aware install step.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { x } from 'tinyexec';
import type { Logger } from './utils.ts';

const PACKAGE_MANAGER_MARKERS = {
  pnpm: ['pnpm-lock.yaml', 'pnpm-workspace.yaml'],
  yarn: ['yarn.lock'],
  bun: ['bun.lockb', 'bun.lock'],
  npm: ['package-lock.json', 'npm-shrinkwrap.json'],
} as const;

function hasAnyMarker(dir: string): boolean {
  return Object.values(PACKAGE_MANAGER_MARKERS).some((files) =>
    files.some((file) => existsSync(join(dir, file)))
  );
}

/** Detect the package manager from lock files in a directory. */
export function detectPackageManager(dir: string): string {
  if (PACKAGE_MANAGER_MARKERS.pnpm.some((file) => existsSync(join(dir, file)))) return 'pnpm';
  if (PACKAGE_MANAGER_MARKERS.yarn.some((file) => existsSync(join(dir, file)))) return 'yarn';
  if (PACKAGE_MANAGER_MARKERS.bun.some((file) => existsSync(join(dir, file)))) return 'bun';
  if (PACKAGE_MANAGER_MARKERS.npm.some((file) => existsSync(join(dir, file)))) return 'npm';
  return 'npm';
}

/**
 * Resolve the directory where dependency installation should run.
 *
 * For nested projects inside a workspace, the lockfile often lives above `dir`.
 * We walk upward until we find the closest package-manager marker, stopping at
 * the cloned repo root so we do not accidentally use markers from outside the trial.
 */
export function resolveInstallRoot(dir: string, stopAt?: string): string {
  const start = resolve(dir);
  const boundary = stopAt ? resolve(stopAt) : undefined;

  let current = start;
  while (true) {
    if (hasAnyMarker(current)) {
      return current;
    }

    if (boundary && current === boundary) {
      return start;
    }

    const parent = dirname(current);
    if (parent === current) {
      return start;
    }

    current = parent;
  }
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
  env?: Record<string, string>,
  options?: { stopAt?: string }
): Promise<void> {
  const installRoot = resolveInstallRoot(dir, options?.stopAt);
  const pm = detectPackageManager(installRoot);
  const [cmd, args] = getInstallArgs(pm, installRoot);
  logger.logStep(
    installRoot === resolve(dir)
      ? `Installing with ${pm}...`
      : `Installing with ${pm} from ${installRoot}...`
  );
  await x(cmd, args, {
    timeout: 300_000,
    nodeOptions: { cwd: installRoot, ...(env && { env: env as NodeJS.ProcessEnv }) },
  });
}
