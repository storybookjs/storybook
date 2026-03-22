import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { join } from 'path';
import waitOn from 'wait-on';

import { ROOT_DIRECTORY, SANDBOX_DIRECTORY } from './utils/constants';
import { exec } from './utils/exec';

process.setMaxListeners(50);

const DEBUG_DISK = Boolean(process.env.STORYBOOK_DEBUG_DISK);

function shellQuote(value: string) {
  return `'${value.replaceAll(`'`, `'\\''`)}'`;
}

function logCommand(command: string) {
  console.log(`$ ${command}`);
  try {
    const output = execSync(command, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    }).trim();

    if (output) {
      console.log(output);
    }
  } catch {
    // Diagnostic commands are best-effort
  }
}

function logDiskDiagnostics(label: string, sandboxDir: string, cacheDir: string) {
  if (!DEBUG_DISK) {
    return;
  }

  console.log(`\n=== Disk diagnostics: ${label} ===`);

  if (process.platform === 'win32') {
    return;
  }

  const home = process.env.HOME;
  const paths = [
    sandboxDir,
    join(sandboxDir, '.yarn', 'cache'),
    join(sandboxDir, 'node_modules'),
    cacheDir,
    join(cacheDir, '.yarn', 'cache'),
    join(cacheDir, 'node_modules'),
    SANDBOX_DIRECTORY,
    join(ROOT_DIRECTORY, 'sandbox'),
    home ? join(home, '.yarn', 'berry') : undefined,
  ].filter(Boolean) as string[];

  logCommand(`df -h ${shellQuote(ROOT_DIRECTORY)}`);
  logCommand(`du -sh ${paths.map(shellQuote).join(' ')} 2>/dev/null`);
  logCommand(
    `find ${shellQuote(SANDBOX_DIRECTORY)} -mindepth 3 -maxdepth 3 -type d -path '*/.yarn/cache' -exec du -sh {} + 2>/dev/null | sort -h | tail -n 20`
  );
  logCommand(
    `find ${shellQuote(SANDBOX_DIRECTORY)} -mindepth 2 -maxdepth 2 -type d -name node_modules -exec du -sh {} + 2>/dev/null | sort -h | tail -n 20`
  );
}

const {
  values: { link, template },
} = parseArgs({
  options: {
    template: { type: 'string' },
    link: { type: 'boolean', default: true },
  },
  allowNegative: true,
});

async function main() {
  if (!template) {
    throw new Error('Missing required --template option for prepare-sandbox.');
  }
  const templateDir = template.replace('/', '-');

  const sandboxDir = join(SANDBOX_DIRECTORY, templateDir);
  const cacheDir = join(ROOT_DIRECTORY, 'sandbox', templateDir);

  if (!existsSync(join(sandboxDir, 'node_modules'))) {
    if (sandboxDir !== cacheDir) {
      console.log(`🧹 copying cached ${cacheDir} to ${sandboxDir}`);
      await rm(sandboxDir, { recursive: true, force: true });
      if (!existsSync(join(cacheDir))) {
        throw new Error(
          `Sandbox should exist at ${cacheDir}. Did you forget to run the sandbox command first?`
        );
      }
      // cache dir is created in the sandbox command that should be run before this script
      await cp(cacheDir, sandboxDir, { recursive: true, force: true });
    }

    if (!link) {
      await waitOn({
        log: true,
        resources: ['http://localhost:6001', 'http://localhost:6002'],
        interval: 16,
        timeout: 10000,
      });
    }

    logDiskDiagnostics('before yarn install', sandboxDir, cacheDir);
    try {
      await exec('yarn install --immutable', { cwd: sandboxDir }, { debug: true });
    } catch (error) {
      logDiskDiagnostics('after failed yarn install', sandboxDir, cacheDir);
      throw error;
    }
    logDiskDiagnostics('after yarn install', sandboxDir, cacheDir);
  }

  if (template.includes('svelte-kit')) {
    await exec('yarn exec svelte-kit sync', { cwd: sandboxDir }, { debug: true });
  }

  const storybookStaticSandboxDir = join(sandboxDir, 'storybook-static');
  const storybookStaticCacheDir = join(cacheDir, 'storybook-static');

  if (existsSync(storybookStaticCacheDir) && !existsSync(storybookStaticSandboxDir)) {
    console.log(`🧹 copying cached ${storybookStaticCacheDir} to ${storybookStaticSandboxDir}`);
    await cp(storybookStaticCacheDir, storybookStaticSandboxDir, {
      recursive: true,
      force: true,
    });
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
