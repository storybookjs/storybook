import { existsSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { join } from 'path';
import waitOn from 'wait-on';

import { ROOT_DIRECTORY, SANDBOX_DIRECTORY } from './utils/constants';
import { exec } from './utils/exec';

process.setMaxListeners(50);

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

    await exec('yarn install --immutable', { cwd: sandboxDir }, { debug: true });
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
