import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { skipWindows } from '../../code/vitest.helpers.ts';
import type { Project } from './lib/projects.ts';
import { syncStorybookVersion } from './sync-storybook-version.ts';

// These tests drive real git subprocesses; the 5s default timeout flakes on loaded machines.
vi.setConfig({ testTimeout: 30_000 });

let TMP = '';

afterEach(() => {
  if (TMP) {
    rmSync(TMP, { recursive: true, force: true });
    TMP = '';
  }
});

describe('syncStorybookVersion', () => {
  skipWindows(() => {
    it('runs the upgrade for each project, commits, and pushes', async () => {
      TMP = mkdtempSync(join(tmpdir(), 'eval-sync-storybook-version-'));
      const reposRoot = join(TMP, 'repos');
      const remotesRoot = join(TMP, 'remotes');
      await mkdir(reposRoot, { recursive: true });
      await mkdir(remotesRoot, { recursive: true });

      const projects: Project[] = [
        {
          name: 'mealdrop',
          repo: join(remotesRoot, 'mealdrop.git'),
          branch: 'main',
          githubSlug: 'storybook-tmp/mealdrop',
        },
        {
          name: 'wikitok',
          repo: join(remotesRoot, 'wikitok.git'),
          branch: 'main',
          githubSlug: 'storybook-tmp/wikitok',
          projectDir: 'frontend',
        },
      ];

      setupRepo({
        repoRoot: join(reposRoot, 'mealdrop'),
        remoteRoot: join(remotesRoot, 'mealdrop.git'),
        packageJsonPath: 'package.json',
        packageJson: {
          name: 'mealdrop',
          dependencies: { '@storybook/react-vite': '9.0.0', storybook: '9.0.0' },
        },
      });
      setupRepo({
        repoRoot: join(reposRoot, 'wikitok'),
        remoteRoot: join(remotesRoot, 'wikitok.git'),
        packageJsonPath: 'frontend/package.json',
        packageJson: {
          name: 'wikitok-frontend',
          dependencies: { '@storybook/react-vite': '9.0.0', storybook: '9.0.0' },
        },
      });

      const upgradeCalls: Array<{
        version: string;
        project: string;
        repoRoot: string;
        projectPath: string;
        configDir: string;
      }> = [];

      const hookOrder: string[] = [];

      const results = await syncStorybookVersion({
        version: '9.1.0',
        reposRoot,
        projects,
        push: true,
        log: () => {},
        installProjectDeps: async ({ project }) => {
          hookOrder.push(`install:${project.name}`);
        },
        runUpgrade: async ({ version, project, repoRoot, projectPath, configDir }) => {
          hookOrder.push(`upgrade:${project.name}`);
          upgradeCalls.push({
            version,
            project: project.name,
            repoRoot,
            projectPath,
            configDir,
          });
          const pkgPath = join(projectPath, 'package.json');
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          for (const key of Object.keys(pkg.dependencies ?? {})) {
            if (key === 'storybook' || key.startsWith('@storybook/')) {
              pkg.dependencies[key] = version;
            }
          }
          writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
        },
      });

      expect(hookOrder).toEqual([
        'install:mealdrop',
        'upgrade:mealdrop',
        'install:mealdrop',
        'install:wikitok',
        'upgrade:wikitok',
        'install:wikitok',
      ]);

      expect(upgradeCalls).toEqual([
        {
          version: '9.1.0',
          project: 'mealdrop',
          repoRoot: join(reposRoot, 'mealdrop'),
          projectPath: join(reposRoot, 'mealdrop'),
          configDir: '.storybook',
        },
        {
          version: '9.1.0',
          project: 'wikitok',
          repoRoot: join(reposRoot, 'wikitok'),
          projectPath: join(reposRoot, 'wikitok', 'frontend'),
          configDir: 'frontend/.storybook',
        },
      ]);

      const mealdropPkg = JSON.parse(
        readFileSync(join(reposRoot, 'mealdrop', 'package.json'), 'utf-8')
      );
      const wikitokPkg = JSON.parse(
        readFileSync(join(reposRoot, 'wikitok', 'frontend', 'package.json'), 'utf-8')
      );
      expect(mealdropPkg.dependencies.storybook).toBe('9.1.0');
      expect(mealdropPkg.dependencies['@storybook/react-vite']).toBe('9.1.0');
      expect(wikitokPkg.dependencies.storybook).toBe('9.1.0');
      expect(wikitokPkg.dependencies['@storybook/react-vite']).toBe('9.1.0');

      expect(results.map((r) => r.project)).toEqual(['mealdrop', 'wikitok']);
      expect(results.every((r) => r.changed)).toBe(true);
      expect(results.every((r) => typeof r.commitSha === 'string' && r.commitSha.length > 0)).toBe(
        true
      );

      expect(getLatestCommitMessage(join(reposRoot, 'mealdrop'))).toBe(
        'Eval: upgrade Storybook to 9.1.0'
      );
      expect(getHead(join(reposRoot, 'mealdrop'))).toBe(
        getRemoteHead(join(remotesRoot, 'mealdrop.git'))
      );
      expect(getHead(join(reposRoot, 'wikitok'))).toBe(
        getRemoteHead(join(remotesRoot, 'wikitok.git'))
      );
    });
  });

  it('reports no change and skips commit when upgrade does not modify files', async () => {
    TMP = mkdtempSync(join(tmpdir(), 'eval-sync-storybook-version-noop-'));
    const reposRoot = join(TMP, 'repos');
    const remotesRoot = join(TMP, 'remotes');
    await mkdir(reposRoot, { recursive: true });
    await mkdir(remotesRoot, { recursive: true });

    const projects: Project[] = [
      {
        name: 'mealdrop',
        repo: join(remotesRoot, 'mealdrop.git'),
        branch: 'main',
        githubSlug: 'storybook-tmp/mealdrop',
      },
    ];

    setupRepo({
      repoRoot: join(reposRoot, 'mealdrop'),
      remoteRoot: join(remotesRoot, 'mealdrop.git'),
      packageJsonPath: 'package.json',
      packageJson: {
        name: 'mealdrop',
        dependencies: { storybook: '9.1.0' },
      },
    });

    const headBefore = getHead(join(reposRoot, 'mealdrop'));

    const results = await syncStorybookVersion({
      version: '9.1.0',
      reposRoot,
      projects,
      push: true,
      log: () => {},
      installProjectDeps: async () => {},
      runUpgrade: async () => {},
    });

    expect(results).toEqual([{ project: 'mealdrop', changed: false }]);
    expect(getHead(join(reposRoot, 'mealdrop'))).toBe(headBefore);
  });

  it('fails fast when a target repo is dirty', async () => {
    TMP = mkdtempSync(join(tmpdir(), 'eval-sync-storybook-version-dirty-'));
    const reposRoot = join(TMP, 'repos');
    const remotesRoot = join(TMP, 'remotes');
    await mkdir(reposRoot, { recursive: true });
    await mkdir(remotesRoot, { recursive: true });

    const projects: Project[] = [
      {
        name: 'mealdrop',
        repo: join(remotesRoot, 'mealdrop.git'),
        branch: 'main',
        githubSlug: 'storybook-tmp/mealdrop',
      },
    ];

    setupRepo({
      repoRoot: join(reposRoot, 'mealdrop'),
      remoteRoot: join(remotesRoot, 'mealdrop.git'),
      packageJsonPath: 'package.json',
      packageJson: {
        name: 'mealdrop',
        dependencies: { storybook: '9.0.0' },
      },
    });

    writeFileSync(join(reposRoot, 'mealdrop', 'README.md'), 'dirty\n');

    const upgradeCalls: string[] = [];

    await expect(
      syncStorybookVersion({
        version: '9.1.0',
        reposRoot,
        projects,
        push: true,
        log: () => {},
        installProjectDeps: async () => {},
        runUpgrade: async ({ project }) => {
          upgradeCalls.push(project.name);
        },
      })
    ).rejects.toThrow('mealdrop has local changes');

    expect(upgradeCalls).toEqual([]);
  });

  it('auto-clones repos that have not been cloned yet', async () => {
    TMP = mkdtempSync(join(tmpdir(), 'eval-sync-storybook-version-auto-clone-'));
    const reposRoot = join(TMP, 'repos');
    const remotesRoot = join(TMP, 'remotes');
    await mkdir(reposRoot, { recursive: true });
    await mkdir(remotesRoot, { recursive: true });

    const projects: Project[] = [
      {
        name: 'mealdrop',
        repo: join(remotesRoot, 'mealdrop.git'),
        branch: 'main',
        githubSlug: 'storybook-tmp/mealdrop',
      },
    ];

    setupBareRemoteWithContent({
      remoteRoot: join(remotesRoot, 'mealdrop.git'),
      files: {
        'package.json': `${JSON.stringify(
          { name: 'mealdrop', dependencies: { storybook: '9.0.0' } },
          null,
          2
        )}\n`,
      },
    });

    expect(existsSync(join(reposRoot, 'mealdrop'))).toBe(false);

    const results = await syncStorybookVersion({
      version: '9.1.0',
      reposRoot,
      projects,
      push: true,
      log: () => {},
      installProjectDeps: async () => {},
      runUpgrade: async ({ version, projectPath }) => {
        const pkgPath = join(projectPath, 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        pkg.dependencies.storybook = version;
        writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
      },
    });

    expect(existsSync(join(reposRoot, 'mealdrop', '.git'))).toBe(true);
    const pkg = JSON.parse(readFileSync(join(reposRoot, 'mealdrop', 'package.json'), 'utf-8'));
    expect(pkg.dependencies.storybook).toBe('9.1.0');
    expect(results).toEqual([
      { project: 'mealdrop', changed: true, commitSha: getHead(join(reposRoot, 'mealdrop')) },
    ]);
    expect(getHead(join(reposRoot, 'mealdrop'))).toBe(
      getRemoteHead(join(remotesRoot, 'mealdrop.git'))
    );
  });

  it('honors push=false by committing locally but not pushing', async () => {
    TMP = mkdtempSync(join(tmpdir(), 'eval-sync-storybook-version-skip-push-'));
    const reposRoot = join(TMP, 'repos');
    const remotesRoot = join(TMP, 'remotes');
    await mkdir(reposRoot, { recursive: true });
    await mkdir(remotesRoot, { recursive: true });

    const projects: Project[] = [
      {
        name: 'mealdrop',
        repo: join(remotesRoot, 'mealdrop.git'),
        branch: 'main',
        githubSlug: 'storybook-tmp/mealdrop',
      },
    ];

    setupRepo({
      repoRoot: join(reposRoot, 'mealdrop'),
      remoteRoot: join(remotesRoot, 'mealdrop.git'),
      packageJsonPath: 'package.json',
      packageJson: {
        name: 'mealdrop',
        dependencies: { storybook: '9.0.0' },
      },
    });

    const remoteHeadBefore = getRemoteHead(join(remotesRoot, 'mealdrop.git'));

    await syncStorybookVersion({
      version: '9.1.0',
      reposRoot,
      projects,
      push: false,
      log: () => {},
      installProjectDeps: async () => {},
      runUpgrade: async ({ version, projectPath }) => {
        const pkgPath = join(projectPath, 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        pkg.dependencies.storybook = version;
        writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
      },
    });

    const localHead = getHead(join(reposRoot, 'mealdrop'));
    expect(localHead).not.toBe(remoteHeadBefore);
    expect(getRemoteHead(join(remotesRoot, 'mealdrop.git'))).toBe(remoteHeadBefore);
  });

  it('pushes an existing local upgrade commit on a rerun after skip-push', async () => {
    TMP = mkdtempSync(join(tmpdir(), 'eval-sync-storybook-version-resume-push-'));
    const reposRoot = join(TMP, 'repos');
    const remotesRoot = join(TMP, 'remotes');
    await mkdir(reposRoot, { recursive: true });
    await mkdir(remotesRoot, { recursive: true });

    const projects: Project[] = [
      {
        name: 'mealdrop',
        repo: join(remotesRoot, 'mealdrop.git'),
        branch: 'main',
        githubSlug: 'storybook-tmp/mealdrop',
      },
    ];

    setupRepo({
      repoRoot: join(reposRoot, 'mealdrop'),
      remoteRoot: join(remotesRoot, 'mealdrop.git'),
      packageJsonPath: 'package.json',
      packageJson: {
        name: 'mealdrop',
        dependencies: { storybook: '9.0.0' },
      },
    });

    const remoteHeadBefore = getRemoteHead(join(remotesRoot, 'mealdrop.git'));

    await syncStorybookVersion({
      version: '9.1.0',
      reposRoot,
      projects,
      push: false,
      log: () => {},
      installProjectDeps: async () => {},
      runUpgrade: async ({ version, projectPath }) => {
        const pkgPath = join(projectPath, 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        pkg.dependencies.storybook = version;
        writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
      },
    });

    const localHead = getHead(join(reposRoot, 'mealdrop'));
    expect(localHead).not.toBe(remoteHeadBefore);
    expect(getRemoteHead(join(remotesRoot, 'mealdrop.git'))).toBe(remoteHeadBefore);

    const results = await syncStorybookVersion({
      version: '9.1.0',
      reposRoot,
      projects,
      push: true,
      log: () => {},
      installProjectDeps: async () => {},
      runUpgrade: async ({ version, projectPath }) => {
        const pkgPath = join(projectPath, 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        pkg.dependencies.storybook = version;
        writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
      },
    });

    expect(results).toEqual([{ project: 'mealdrop', changed: true, commitSha: localHead }]);
    expect(getRemoteHead(join(remotesRoot, 'mealdrop.git'))).toBe(localHead);
  });
});

function setupRepo(opts: {
  repoRoot: string;
  remoteRoot: string;
  packageJsonPath: string;
  packageJson: Record<string, unknown>;
}) {
  execFileSync('git', ['init', '--bare', '--initial-branch=main', opts.remoteRoot]);
  execFileSync('git', ['init', '--initial-branch=main', opts.repoRoot]);
  execFileSync('git', ['-C', opts.repoRoot, 'config', 'user.name', 'Test User']);
  execFileSync('git', ['-C', opts.repoRoot, 'config', 'user.email', 'test@example.com']);

  const pkgPath = join(opts.repoRoot, opts.packageJsonPath);
  mkdirSyncRecursive(dirname(pkgPath));
  writeFileSync(pkgPath, `${JSON.stringify(opts.packageJson, null, 2)}\n`);

  execFileSync('git', ['-C', opts.repoRoot, 'add', '-A']);
  execFileSync('git', ['-C', opts.repoRoot, 'commit', '-m', 'initial']);
  execFileSync('git', ['-C', opts.repoRoot, 'remote', 'add', 'origin', opts.remoteRoot]);
  execFileSync('git', ['-C', opts.repoRoot, 'push', '-u', 'origin', 'main']);
}

function setupBareRemoteWithContent(opts: { remoteRoot: string; files: Record<string, string> }) {
  const staging = mkdtempSync(join(tmpdir(), 'eval-sync-storybook-version-staging-'));
  execFileSync('git', ['init', '--bare', '--initial-branch=main', opts.remoteRoot]);
  execFileSync('git', ['clone', opts.remoteRoot, staging]);
  execFileSync('git', ['-C', staging, 'config', 'user.name', 'Test User']);
  execFileSync('git', ['-C', staging, 'config', 'user.email', 'test@example.com']);
  for (const [path, contents] of Object.entries(opts.files)) {
    mkdirSyncRecursive(join(staging, dirname(path)));
    writeFileSync(join(staging, path), contents);
  }
  execFileSync('git', ['-C', staging, 'add', '-A']);
  execFileSync('git', ['-C', staging, 'commit', '-m', 'initial']);
  execFileSync('git', ['-C', staging, 'push', 'origin', 'main']);
  rmSync(staging, { recursive: true, force: true });
}

function mkdirSyncRecursive(path: string) {
  execFileSync('mkdir', ['-p', path]);
}

function getHead(repoRoot: string) {
  return execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], {
    encoding: 'utf-8',
  }).trim();
}

function getRemoteHead(remoteRoot: string) {
  return execFileSync('git', ['--git-dir', remoteRoot, 'rev-parse', 'refs/heads/main'], {
    encoding: 'utf-8',
  }).trim();
}

function getLatestCommitMessage(repoRoot: string) {
  return execFileSync('git', ['-C', repoRoot, 'log', '-1', '--pretty=%s'], {
    encoding: 'utf-8',
  }).trim();
}
