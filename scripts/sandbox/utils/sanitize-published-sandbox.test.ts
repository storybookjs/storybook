import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';

import {
  EXCLUDE_GLOBS,
  STRIP_KEYS,
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

describe('STRIP_KEYS', () => {
  it('contains exactly the documented host-local / verdaccio keys', () => {
    // Mutating this list requires deliberate code review — if you are touching it,
    // make sure the published sandboxes repository contract is intentional.
    expect([...STRIP_KEYS]).toEqual([
      'npmRegistryServer',
      'unsafeHttpWhitelist',
      'enableImmutableInstalls',
      'enableMirror',
      'logFilters',
      'npmMinimalAgeGate',
      'npmPreapprovedPackages',
      'pnpFallbackMode',
      'enableGlobalCache',
      'checksumBehavior',
    ]);
  });
});

describe('EXCLUDE_GLOBS', () => {
  it('targets only known install / build artifacts', () => {
    expect([...EXCLUDE_GLOBS]).toEqual([
      '**/.yarn/cache/**',
      '**/.yarn/install-state.gz',
      '**/.yarn/build-state.yml',
      '**/.yarn/unplugged/**',
      '**/.pnp.cjs',
      '**/.pnp.loader.mjs',
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

  afterEach(async () => {
    // tmpdir cleanup is best-effort; not strictly required for correctness
  });

  it('strips every STRIP_KEYS entry from after-storybook/.yarnrc.yml', async () => {
    const afterDir = join(root, 'react-vite', 'default-ts', 'after-storybook');
    await mkdir(afterDir, { recursive: true });
    const yarnrc = [
      'nodeLinker: node-modules',
      'npmRegistryServer: "http://localhost:6001/"',
      'unsafeHttpWhitelist: "localhost"',
      'enableImmutableInstalls: false',
      'enableMirror: false',
      'logFilters: []',
      'npmMinimalAgeGate: 0',
      'npmPreapprovedPackages: ["next", "@next/*"]',
      'pnpFallbackMode: none',
      'enableGlobalCache: true',
      'checksumBehavior: ignore',
      '',
    ].join('\n');
    await writeFile(join(afterDir, '.yarnrc.yml'), yarnrc);

    const result = await sanitizePublishedSandboxes(root);

    expect(result.filteredYarnrcCount).toBe(1);
    expect(result.strippedKeyCount).toBe(STRIP_KEYS.length);

    const sanitized = await readFile(join(afterDir, '.yarnrc.yml'), 'utf-8');
    for (const key of STRIP_KEYS) {
      expect(sanitized).not.toContain(key);
    }
    // Non-stripped keys are preserved
    expect(sanitized).toContain('nodeLinker');
  });

  it('leaves before-storybook/.yarnrc.yml untouched', async () => {
    const beforeDir = join(root, 'react-vite', 'default-ts', 'before-storybook');
    await mkdir(beforeDir, { recursive: true });
    const yarnrc = ['nodeLinker: node-modules', 'enableGlobalCache: true', ''].join('\n');
    await writeFile(join(beforeDir, '.yarnrc.yml'), yarnrc);

    const result = await sanitizePublishedSandboxes(root);

    expect(result.filteredYarnrcCount).toBe(0);
    const preserved = await readFile(join(beforeDir, '.yarnrc.yml'), 'utf-8');
    expect(preserved).toContain('enableGlobalCache');
    expect(preserved).toContain('nodeLinker');
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
    await writeFile(join(afterDir, '.pnp.cjs'), '/* zero install */');
    await writeFile(join(afterDir, 'README.md'), '# kept');

    const result = await sanitizePublishedSandboxes(root);

    expect(result.removedPaths).toBeGreaterThan(0);
    expect(await exists(afterCache)).toBe(false);
    expect(await exists(beforeNodeModules)).toBe(false);
    expect(await exists(join(afterDir, '.pnp.cjs'))).toBe(false);
    // Non-excluded files survive
    expect(await exists(join(afterDir, 'README.md'))).toBe(true);
  });

  it('writes an empty file when stripping leaves no keys', async () => {
    const afterDir = join(root, 'svelte-vite', 'default-ts', 'after-storybook');
    await mkdir(afterDir, { recursive: true });
    await writeFile(join(afterDir, '.yarnrc.yml'), 'npmRegistryServer: "http://localhost:6001/"\n');

    await sanitizePublishedSandboxes(root);

    const sanitized = await readFile(join(afterDir, '.yarnrc.yml'), 'utf-8');
    expect(sanitized).toBe('');
  });

  it('is idempotent — a second run is a no-op', async () => {
    const afterDir = join(root, 'react-vite', 'default-ts', 'after-storybook');
    await mkdir(afterDir, { recursive: true });
    await writeFile(
      join(afterDir, '.yarnrc.yml'),
      'nodeLinker: node-modules\nnpmRegistryServer: "http://localhost:6001/"\n'
    );

    await sanitizePublishedSandboxes(root);
    const second = await sanitizePublishedSandboxes(root);

    expect(second.filteredYarnrcCount).toBe(0);
    expect(second.strippedKeyCount).toBe(0);
    expect(second.removedPaths).toBe(0);
  });
});

describe('ensureLockfilePublishRules', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'sandbox-gitignore-'));
  });

  const stagedFiles = async () => {
    await execaCommand('git init -q .', { cwd: root });
    await execaCommand('git add .', { cwd: root });
    const { stdout } = await execaCommand('git diff --cached --name-only', { cwd: root });
    return stdout.split('\n').filter(Boolean);
  };

  const seedSandbox = async () => {
    for (const dir of ['before-storybook', 'after-storybook']) {
      await mkdir(join(root, 'angular-cli-default-ts', dir), { recursive: true });
      await writeFile(join(root, 'angular-cli-default-ts', dir, 'yarn.lock'), '# lockfile\n');
    }
  };

  it('publishes the before-storybook lockfile and still withholds the after-storybook one', async () => {
    // The sandboxes repository ignores lockfiles wholesale.
    await writeFile(join(root, '.gitignore'), 'node_modules\n\nyarn.lock\npackage-lock.json\n');
    await seedSandbox();

    await ensureLockfilePublishRules(root);

    const staged = await stagedFiles();
    expect(staged).toContain('angular-cli-default-ts/before-storybook/yarn.lock');
    expect(staged).not.toContain('angular-cli-default-ts/after-storybook/yarn.lock');
  });

  it('withholds the after-storybook lockfile even when nothing was ignored before', async () => {
    await seedSandbox();

    await ensureLockfilePublishRules(root);

    const staged = await stagedFiles();
    expect(staged).toContain('angular-cli-default-ts/before-storybook/yarn.lock');
    expect(staged).not.toContain('angular-cli-default-ts/after-storybook/yarn.lock');
  });

  it('is idempotent', async () => {
    await writeFile(join(root, '.gitignore'), 'yarn.lock\n');

    expect(await ensureLockfilePublishRules(root)).toBe(true);
    const afterFirst = await readFile(join(root, '.gitignore'), 'utf-8');

    expect(await ensureLockfilePublishRules(root)).toBe(false);
    expect(await readFile(join(root, '.gitignore'), 'utf-8')).toBe(afterFirst);
  });

  it('keeps the repository’s existing ignore rules', async () => {
    await writeFile(join(root, '.gitignore'), 'node_modules\n.angular\nyarn.lock\n');

    await ensureLockfilePublishRules(root);

    const contents = await readFile(join(root, '.gitignore'), 'utf-8');
    expect(contents).toContain('node_modules');
    expect(contents).toContain('.angular');
  });
});
