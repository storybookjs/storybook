import { rename, rm, writeFile } from 'node:fs/promises';

import { join } from 'path';

import { runCommand } from '../generate';

interface SetupYarnOptions {
  cwd: string;
  // TODO: Evaluate if this is correct after removing pnp compatibility code in SB11
  pnp?: boolean;
  version?: 'berry' | 'classic';
}

export async function setupYarn({ cwd, pnp = false, version = 'classic' }: SetupYarnOptions) {
  // force yarn
  await writeFile(join(cwd, 'yarn.lock'), '', { flag: 'a' });
  await runCommand(`yarn set version ${version}`, { cwd });
  await runCommand(`yarn config set enableGlobalCache false`, { cwd });
  if (version === 'berry' && !pnp) {
    await runCommand('yarn config set nodeLinker node-modules', { cwd });
  }
  await rm(join(cwd, 'package.json'), { force: true });
}

export async function localizeYarnConfigFiles(baseDir: string, beforeDir: string) {
  await Promise.allSettled([
    writeFile(join(beforeDir, 'yarn.lock'), '', { flag: 'a' }),
    rename(join(baseDir, '.yarn'), join(beforeDir, '.yarn')),
    rename(join(baseDir, '.yarnrc.yml'), join(beforeDir, '.yarnrc.yml')),
    rename(join(baseDir, '.yarnrc'), join(beforeDir, '.yarnrc')),
  ]);
}
