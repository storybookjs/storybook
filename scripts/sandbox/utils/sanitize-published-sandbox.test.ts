import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'pathe';

import { beforeEach, describe, expect, it } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';

import {
  EXCLUDE_GLOBS,
  GITIGNORE_LOCKFILE_RULES,
  assertPublishedTree,
  ensureLockfilePublishRules,
  sanitizePublishedSandboxes,
} from './sanitize-published-sandbox.ts';

const exists = async (path: string) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const GIT = 'git -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false';

/** The `.gitignore` of storybookjs/sandboxes on `next`, with the managed block for Yarn. */
const SANDBOXES_GITIGNORE = `node_modules
.angular

yarn.lock
package-lock.json
pnpm-lock.yaml
.pnp.*

# Yarn files
/**/.yarn/*
!/**/.yarn/releases
!/**/.yarn/plugins
!/**/.yarn/sdks
!/**/.yarn/versions

# Managed by publish-sandboxes: publish only the before-storybook lockfile
yarn.lock
!**/before-storybook/yarn.lock
`;

describe('EXCLUDE_GLOBS', () => {
  it('targets only known install / build artifacts', () => {
    expect([...EXCLUDE_GLOBS]).toEqual([
      '**/.yarn/cache/**',
      '**/.yarn/install-state.gz',
      '**/.yarn/build-state.yml',
      '**/.yarn/unplugged/**',
      '**/node_modules/**',
      '**/.cache/**',
      '**/storybook-static/**',
    ]);
  });
});

describe('sanitizePublishedSandboxes', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'sanitize-sandbox-'));
  });

  it('removes EXCLUDE_GLOBS matches from the tree', async () => {
    const afterDir = join(root, 'react-vite', 'default-ts', 'after-storybook');
    const beforeDir = join(root, 'react-vite', 'default-ts', 'before-storybook');
    const afterCache = join(afterDir, '.yarn', 'cache');
    const beforeNodeModules = join(beforeDir, 'node_modules', 'some-pkg');

    await mkdir(afterCache, { recursive: true });
    await writeFile(join(afterCache, 'pkg.zip'), 'binary blob');
    await mkdir(beforeNodeModules, { recursive: true });
    await writeFile(join(beforeNodeModules, 'index.js'), 'export {}');
    await writeFile(join(afterDir, 'README.md'), '# kept');

    const result = await sanitizePublishedSandboxes(root);

    expect(result.removedPaths).toBeGreaterThan(0);
    expect(await exists(afterCache)).toBe(false);
    expect(await exists(beforeNodeModules)).toBe(false);
    // Non-excluded files survive
    expect(await exists(join(afterDir, 'README.md'))).toBe(true);
  });

  it('leaves the pnpm config of after-storybook as init wrote it', async () => {
    const afterDir = join(root, 'react-vite', 'default-ts', 'after-storybook');
    await mkdir(afterDir, { recursive: true });
    const config = 'packages:\n  - .\nminimumReleaseAge: 1440\nallowBuilds:\n  esbuild: true\n';
    await writeFile(join(afterDir, 'pnpm-workspace.yaml'), config);

    await sanitizePublishedSandboxes(root);

    expect(await readFile(join(afterDir, 'pnpm-workspace.yaml'), 'utf-8')).toBe(config);
  });

  it('is idempotent — a second run is a no-op', async () => {
    await mkdir(join(root, 'react-vite', 'default-ts', 'after-storybook', 'node_modules'), {
      recursive: true,
    });

    await sanitizePublishedSandboxes(root);
    const second = await sanitizePublishedSandboxes(root);

    expect(second.removedPaths).toBe(0);
  });
});

describe('ensureLockfilePublishRules', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'sandbox-gitignore-'));
    await execaCommand('git init -q .', { cwd: root });
  });

  const write = async (file: string, contents = '# lockfile\n') => {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), contents);
  };

  const stagedFiles = async () => {
    await execaCommand('git add .', { cwd: root });
    const { stdout } = await execaCommand('git diff --cached --name-only', { cwd: root });
    return stdout.split('\n').filter(Boolean);
  };

  const seedSandbox = async () => {
    for (const dir of ['before-storybook', 'after-storybook']) {
      await write(`angular-cli/default-ts/${dir}/pnpm-lock.yaml`);
    }
    // A stray Yarn lockfile must not be published either.
    await write('angular-cli/default-ts/after-storybook/yarn.lock');
  };

  it('publishes exactly the before-storybook pnpm lockfile', () => {
    expect([...GITIGNORE_LOCKFILE_RULES]).toEqual([
      'yarn.lock',
      'pnpm-lock.yaml',
      '!**/before-storybook/pnpm-lock.yaml',
    ]);
  });

  it('publishes the before-storybook lockfile and withholds every after-storybook one', async () => {
    await writeFile(join(root, '.gitignore'), SANDBOXES_GITIGNORE);
    await seedSandbox();

    await ensureLockfilePublishRules(root);

    const staged = await stagedFiles();
    expect(staged).toContain('angular-cli/default-ts/before-storybook/pnpm-lock.yaml');
    expect(staged).not.toContain('angular-cli/default-ts/after-storybook/pnpm-lock.yaml');
    expect(staged).not.toContain('angular-cli/default-ts/after-storybook/yarn.lock');
  });

  it('withholds the after-storybook lockfile even when nothing was ignored before', async () => {
    await seedSandbox();

    await ensureLockfilePublishRules(root);

    const staged = await stagedFiles();
    expect(staged).toContain('angular-cli/default-ts/before-storybook/pnpm-lock.yaml');
    expect(staged).not.toContain('angular-cli/default-ts/after-storybook/pnpm-lock.yaml');
  });

  it('replaces the managed Yarn block instead of adding a second one', async () => {
    await writeFile(join(root, '.gitignore'), SANDBOXES_GITIGNORE);

    expect(await ensureLockfilePublishRules(root)).toBe(true);

    const contents = await readFile(join(root, '.gitignore'), 'utf-8');
    expect(contents).toBe(
      SANDBOXES_GITIGNORE.replace(
        'yarn.lock\n!**/before-storybook/yarn.lock\n',
        'yarn.lock\npnpm-lock.yaml\n!**/before-storybook/pnpm-lock.yaml\n'
      )
    );
  });

  it('moves the managed block to the end, where it takes precedence', async () => {
    await writeFile(
      join(root, '.gitignore'),
      '# Managed by publish-sandboxes: publish only the before-storybook lockfile\nyarn.lock\n!**/before-storybook/yarn.lock\n\npnpm-lock.yaml\n'
    );

    await ensureLockfilePublishRules(root);

    expect(await readFile(join(root, '.gitignore'), 'utf-8')).toBe(
      'pnpm-lock.yaml\n\n# Managed by publish-sandboxes: publish only the before-storybook lockfile\nyarn.lock\npnpm-lock.yaml\n!**/before-storybook/pnpm-lock.yaml\n'
    );
  });

  it('is idempotent', async () => {
    await writeFile(join(root, '.gitignore'), SANDBOXES_GITIGNORE);

    await ensureLockfilePublishRules(root);
    const afterFirst = await readFile(join(root, '.gitignore'), 'utf-8');

    expect(await ensureLockfilePublishRules(root)).toBe(false);
    expect(await readFile(join(root, '.gitignore'), 'utf-8')).toBe(afterFirst);
  });

  it('keeps a Yarn lockfile tracked in a folder that is not regenerated', async () => {
    await writeFile(join(root, '.gitignore'), SANDBOXES_GITIGNORE);
    await write('nextjs/13-ts/before-storybook/yarn.lock');
    await execaCommand('git add .', { cwd: root });
    await execaCommand(`${GIT} commit -qm seed`, { cwd: root });
    await write('nextjs/13-ts/before-storybook/yarn.lock', '# changed\n');

    await ensureLockfilePublishRules(root);

    expect(await stagedFiles()).toContain('nextjs/13-ts/before-storybook/yarn.lock');
  });

  it('keeps the repository’s existing ignore rules', async () => {
    await writeFile(join(root, '.gitignore'), 'node_modules\n.angular\nyarn.lock\n');

    await ensureLockfilePublishRules(root);

    const contents = await readFile(join(root, '.gitignore'), 'utf-8');
    expect(contents).toContain('node_modules');
    expect(contents).toContain('.angular');
  });
});

describe('assertPublishedTree', () => {
  const TEMPLATE = 'react-vite/default-ts';
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'sandbox-publish-'));
    await execaCommand('git init -q .', { cwd: root });
    await write(`${TEMPLATE}/before-storybook/package.json`, '{"packageManager":"pnpm@10.34.9"}');
    await write(
      `${TEMPLATE}/before-storybook/pnpm-lock.yaml`,
      "lockfileVersion: '9.0'\npackages:\n  vite@8.3.5:\n    resolution: {integrity: sha512-abc}\n"
    );
    await write(`${TEMPLATE}/after-storybook/README.md`, '# React\n');
    await write(`${TEMPLATE}/after-storybook/pnpm-lock.yaml`);
    await writeFile(join(root, '.gitignore'), SANDBOXES_GITIGNORE);
    await ensureLockfilePublishRules(root);
  });

  const write = async (file: string, contents = '# lockfile\n') => {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), contents);
  };

  const stageAndAssert = async (templates = [TEMPLATE]) => {
    await execaCommand('git add .', { cwd: root });
    return assertPublishedTree(root, templates);
  };

  it('accepts a template whose lockfile is tracked and installable from npm', async () => {
    await expect(stageAndAssert()).resolves.toBeUndefined();
  });

  it('refuses a before-storybook lockfile that git would drop', async () => {
    await writeFile(join(root, '.gitignore'), SANDBOXES_GITIGNORE);

    await expect(stageAndAssert()).rejects.toThrow(
      `${TEMPLATE}/before-storybook/pnpm-lock.yaml is not tracked`
    );
  });

  it('refuses a file that points at the local registry', async () => {
    await write(`${TEMPLATE}/after-storybook/.npmrc`, 'registry=http://localhost:6001/\n');

    await expect(stageAndAssert()).rejects.toThrow(
      `${TEMPLATE}/after-storybook/.npmrc points at the local registry`
    );
  });

  it('refuses a before-storybook lockfile that pins tarball URLs', async () => {
    await write(
      `${TEMPLATE}/before-storybook/pnpm-lock.yaml`,
      "lockfileVersion: '9.0'\npackages:\n  vite@8.3.5:\n    resolution: {integrity: sha512-abc, tarball: https://registry.npmjs.org/vite/-/vite-8.3.5.tgz}\n"
    );

    await expect(stageAndAssert()).rejects.toThrow(
      `${TEMPLATE}/before-storybook/pnpm-lock.yaml has tarball URLs`
    );
  });

  it('refuses a folder with both a Yarn and a pnpm lockfile', async () => {
    // Tracked from an earlier publish, which ignored rules do not untrack.
    await write(`${TEMPLATE}/before-storybook/yarn.lock`);
    await execaCommand(`git add -f ${TEMPLATE}/before-storybook/yarn.lock`, { cwd: root });

    await expect(stageAndAssert()).rejects.toThrow(
      `${TEMPLATE}/before-storybook tracks both yarn.lock and pnpm-lock.yaml`
    );
  });

  it('only checks the templates this run publishes', async () => {
    await write(
      'nextjs/13-ts/after-storybook/.yarnrc.yml',
      'npmRegistryServer: http://localhost:6001\n'
    );

    await expect(stageAndAssert()).resolves.toBeUndefined();
  });
});
