import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { detectPackageManager, resolveInstallRoot } from './package-manager';

const TEMP_DIRS: string[] = [];

afterEach(() => {
  for (const dir of TEMP_DIRS.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('detectPackageManager', () => {
  it('recognizes npm from package-lock files', () => {
    const root = createTempDir('npm-lock');
    writeFile('package-lock.json', root);

    expect(detectPackageManager(root)).toBe('npm');
  });
});

describe('resolveInstallRoot', () => {
  it('keeps nested standalone apps on their own install root', () => {
    const repoRoot = createTempDir('nested-bun');
    const projectDir = join(repoRoot, 'frontend');
    mkdirSync(projectDir, { recursive: true });
    writeFile('frontend/bun.lock', repoRoot);

    expect(resolveInstallRoot(projectDir, repoRoot)).toBe(projectDir);
  });

  it('walks up to the repo workspace root when lockfiles live above projectDir', () => {
    const repoRoot = createTempDir('pnpm-workspace');
    const projectDir = join(repoRoot, 'packages', 'lib');
    mkdirSync(projectDir, { recursive: true });
    writeFile('pnpm-lock.yaml', repoRoot);
    writeFile('pnpm-workspace.yaml', repoRoot);

    expect(resolveInstallRoot(projectDir, repoRoot)).toBe(repoRoot);
  });

  it('does not walk above the cloned repo root', () => {
    const parent = createTempDir('parent-lock');
    const repoRoot = join(parent, 'repo');
    const projectDir = join(repoRoot, 'packages', 'lib');
    mkdirSync(projectDir, { recursive: true });
    writeFile('yarn.lock', parent);

    expect(resolveInstallRoot(projectDir, repoRoot)).toBe(projectDir);
  });
});

function createTempDir(name: string) {
  const dir = join(
    tmpdir(),
    `storybook-eval-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  TEMP_DIRS.push(dir);
  return dir;
}

function writeFile(relativePath: string, root: string) {
  const fullPath = join(root, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, '');
}
