import { existsSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { join } from 'path';
import waitOn from 'wait-on';

import { CODE_DIRECTORY, ROOT_DIRECTORY, SANDBOX_DIRECTORY } from './utils/constants';
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
  const templateDir = template.replace('/', '-');

  const sandboxDir = join(SANDBOX_DIRECTORY, templateDir);
  const cacheDir = join(ROOT_DIRECTORY, 'sandbox', templateDir);
  const storybookStaticSandboxDir = join(sandboxDir, 'storybook-static');
  const storybookStaticCacheDir = join(cacheDir, 'storybook-static');

  if (!existsSync(join(sandboxDir, 'node_modules'))) {
    if (sandboxDir !== cacheDir) {
      console.log(`🧹 copying cached ${cacheDir} to ${sandboxDir}`);
      await rm(sandboxDir, { recursive: true, force: true });
      await cp(cacheDir, sandboxDir, { recursive: true, force: true });
    }

    if (!link) {
      console.log(`🧹 waiting on port 6001 and 6002`);
      try {
        await waitOn({
          log: true,
          resources: ['http://localhost:6001', 'http://localhost:6002'],
          interval: 16,
          timeout: 2000,
        });
      } catch {
        void exec('yarn local-registry --open', { cwd: CODE_DIRECTORY });
        await waitOn({
          log: true,
          resources: ['http://localhost:6001', 'http://localhost:6002'],
          interval: 16,
          timeout: 20000,
        });
      }
    }

    await exec('yarn install --immutable', { cwd: sandboxDir }, { debug: true });
  }

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
