import { readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { MonorepoDetails, Task } from '../task.ts';
import { ROOT_DIRECTORY } from '../utils/constants.ts';
import { exec } from '../utils/exec.ts';
import { maxConcurrentTasks } from '../utils/maxConcurrentTasks.ts';

// The compile task only actually runs in the build--linux / build--windows /
// node-26-smoke jobs, all on xlarge executors (8 vCPUs). os.cpus() reports the
// Docker host's cores rather than the cgroup limit, so use an explicit value on
// CI instead of maxConcurrentTasks.
const CI_VCPUS = 8;

const parallel = `--parallel=${process.env.CI ? CI_VCPUS : maxConcurrentTasks}`;

const linkCommand = `yarn nx run-many -t compile ${parallel}`;
const noLinkCommand = `yarn nx run-many -t compile -c production ${parallel}`;

/**
 * On CI, Nx connected to NX Cloud prints only a cloud link for a failed task, and with no token it
 * prints nothing at all. Stream output keeps compile errors in the CI log, and a CI job without a
 * token skips NX Cloud instead of failing to authenticate.
 */
const ciEnv = (): NodeJS.ProcessEnv =>
  process.env.CI
    ? {
        NX_DEFAULT_OUTPUT_STYLE: process.env.NX_DEFAULT_OUTPUT_STYLE ?? 'stream',
        ...(process.env.NX_CLOUD_ACCESS_TOKEN ? {} : { NX_NO_CLOUD: 'true' }),
      }
    : {};

export const compile: Task<MonorepoDetails> = {
  description: 'Compile the source code of the monorepo',
  dependsOn: ['install'],
  async ready({ codeDir }, { link }) {
    try {
      if (link) {
        await readFile(resolve(codeDir, './core/dist/manager-api/index.js'), 'utf8');
      } else {
        await readFile(resolve(codeDir, './core/dist/manager-api/index.d.ts'), 'utf8');
      }
      return true;
    } catch (err) {
      return false;
    }
  },
  async run({ codeDir }, { link, dryRun, debug, prod, skipCache }) {
    const command = link && !prod ? linkCommand : noLinkCommand;
    await rm(join(codeDir, 'bench/esbuild-metafiles'), { recursive: true, force: true });
    return exec(
      `${command} ${skipCache ? '--skip-nx-cache' : ''}`,
      { cwd: ROOT_DIRECTORY, env: ciEnv() },
      {
        startMessage: '🥾 Bootstrapping',
        errorMessage: '❌ Failed to bootstrap',
        dryRun,
        debug,
      }
    );
  },
};
