import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HandledError, JsPackageManager } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import {
  MainFileEvaluationError,
  UpgradeStorybookConfigDirNotFoundError,
} from 'storybook/internal/server-errors';

import type { UpgradeOptions } from './upgrade.ts';
import {
  type CollectProjectsErrorResult,
  type CollectProjectsSuccessResult,
  checkUnreadableProjects,
  findStorybookProjects,
  getProjects,
  handleMultipleProjects,
} from './util.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

let root: string;

const createFixture = (files: Record<string, string>) => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'storybook-find-projects-')));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
};

afterEach(() => {
  vi.restoreAllMocks();
  if (root) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('findStorybookProjects', () => {
  it('ignores .storybook directories inside node_modules, whatever the .gitignore says', async () => {
    createFixture({
      '.gitignore': '**/**/node_modules/\n',
      'packages/ui/.storybook/main.ts': 'export default {};',
      'node_modules/@nx/storybook/files/project-files/.storybook/main.ts': 'export default {};',
    });

    expect(await findStorybookProjects(root)).toEqual([
      join(root, 'packages/ui/.storybook').replace(/\\/g, '/'),
    ]);
  });
});

describe('findStorybookProjects in a git repository', () => {
  it('skips .storybook directories that git ignores', async () => {
    createFixture({
      '.gitignore': 'generated/\n',
      'packages/ui/.storybook/main.ts': 'export default {};',
      'generated/app/.storybook/main.ts': 'export default {};',
    });
    execFileSync('git', ['init', '-q'], { cwd: root });

    expect(await findStorybookProjects(root)).toEqual([
      join(root, 'packages/ui/.storybook').replace(/\\/g, '/'),
    ]);
  });

  it('skips .storybook directories that a submodule ignores', async () => {
    createFixture({
      'vendor/.gitignore': 'generated/\n',
      'vendor/.storybook/main.ts': 'export default {};',
      'vendor/generated/.storybook/main.ts': 'export default {};',
    });
    const vendor = join(root, 'vendor');
    execFileSync('git', ['init', '-q'], { cwd: vendor });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=test',
        '-c',
        'user.email=test@test',
        'commit',
        '-q',
        '--allow-empty',
        '-m',
        'x',
      ],
      { cwd: vendor }
    );
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['add', 'vendor'], { cwd: root, stdio: 'ignore' });

    expect(await findStorybookProjects(root)).toEqual([
      join(root, 'vendor/.storybook').replace(/\\/g, '/'),
    ]);
  });
});

describe('findStorybookProjects with a repository inside an ignored directory', () => {
  it('skips the .storybook directories of that repository', async () => {
    createFixture({
      '.gitignore': 'repros/\n',
      'packages/ui/.storybook/main.ts': 'export default {};',
      'repros/clone/.storybook/main.ts': 'export default {};',
    });
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['init', '-q'], { cwd: join(root, 'repros/clone') });

    expect(await findStorybookProjects(root)).toEqual([
      join(root, 'packages/ui/.storybook').replace(/\\/g, '/'),
    ]);
  });
});

describe('findStorybookProjects in a directory that git ignores', () => {
  it('still finds the project', async () => {
    createFixture({
      '.gitignore': 'repro/\n',
      'repro/app/.storybook/main.ts': 'export default {};',
    });
    execFileSync('git', ['init', '-q'], { cwd: root });

    const cwd = join(root, 'repro/app');
    expect(await findStorybookProjects(cwd)).toEqual([join(cwd, '.storybook').replace(/\\/g, '/')]);
  });
});

describe('getProjects', () => {
  it('asks for --config-dir instead of prompting when --yes finds no .storybook directory', async () => {
    createFixture({ 'storybook/main.ts': 'export default {};' });
    vi.spyOn(process, 'cwd').mockReturnValue(root);

    await expect(getProjects({ yes: true } as UpgradeOptions)).rejects.toThrow(
      UpgradeStorybookConfigDirNotFoundError
    );
  });
});

describe('handleMultipleProjects', () => {
  const project = (configDir: string) =>
    ({
      configDir,
      packageManager: { packageJsonPaths: [`${dirname(configDir)}/package.json`] },
    }) as unknown as CollectProjectsSuccessResult;
  const projects = [project('/repo/a/.storybook'), project('/repo/b/.storybook')];
  const configDirs = projects.map(({ configDir }) => configDir);

  it('upgrades every project when nobody can answer, without asking which', async () => {
    await expect(handleMultipleProjects(projects, [], configDirs, true, false)).resolves.toEqual(
      projects
    );
    expect(prompt.multiselect).not.toHaveBeenCalled();
  });

  it('asks which projects to upgrade at a terminal, also with --yes', async () => {
    vi.mocked(prompt.multiselect).mockResolvedValue(['/repo/b/.storybook']);

    await expect(handleMultipleProjects(projects, [], configDirs, true)).resolves.toEqual([
      projects[1],
    ]);
  });
});

describe('checkUnreadableProjects', () => {
  const withStorybook = JSON.stringify({ devDependencies: { storybook: '10.6.7' } });
  const main = 'export default {};';
  const readable = (dir: string) =>
    ({
      configDir: join(root, dir, '.storybook'),
      packageManager: {
        packageJsonPaths: JsPackageManager.listAllPackageJsonPaths(join(root, dir)),
      },
    }) as unknown as CollectProjectsSuccessResult;
  const unreadable = (dir: string): CollectProjectsErrorResult => ({
    configDir: join(root, dir, '.storybook'),
    error: new MainFileEvaluationError({
      location: `${dir}/.storybook/main.ts`,
      error: new Error(`Cannot find module 'shared/vite' imported from ${dir}\n    at stack`),
    }),
  });
  const logged = (method: 'error' | 'warn') =>
    String(vi.mocked(logger[method]).mock.calls[0]?.[0] ?? '').replaceAll('\\', '/');

  beforeEach(() => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  it('changes nothing when an unreadable project shares a package.json with the others', () => {
    createFixture({
      'package.json': withStorybook,
      'packages/a/package.json': withStorybook,
      'packages/c/package.json': withStorybook,
      'packages/c/.storybook/main.ts': main,
    });

    expect(() =>
      checkUnreadableProjects([readable('packages/a')], [unreadable('packages/c')])
    ).toThrow(HandledError);
    expect(logged('error')).toMatch(
      /could not read these projects, which share a package\.json with the others, so it changed nothing:\n.*packages\/c\/\.storybook: Cannot find module 'shared\/vite' imported from packages\/c\nFix them and run the upgrade again\. To upgrade only the others, which still upgrades the shared package\.json and leaves these projects behind: npx storybook@\S+ upgrade --config-dir \S*packages\/a\/\.storybook$/
    );
  });

  it('goes on with separate Storybooks, and names the one it leaves and why', () => {
    createFixture({
      'package.json': JSON.stringify({ private: true }),
      'packages/a/package.json': withStorybook,
      'packages/c/package.json': withStorybook,
      'packages/c/.storybook/main.ts': main,
    });

    checkUnreadableProjects([readable('packages/a')], [unreadable('packages/c')]);

    expect(logged('warn')).toMatch(
      /^Not upgrading these Storybook projects, because Storybook could not read them:\n.*packages\/c\/\.storybook: Cannot find module 'shared\/vite' imported from packages\/c$/
    );
  });

  it('stops only for the unreadable projects that share, and names only those', () => {
    createFixture({
      'package.json': JSON.stringify({ private: true }),
      'packages/package.json': withStorybook,
      'packages/a/package.json': withStorybook,
      'packages/c/package.json': withStorybook,
      'packages/c/.storybook/main.ts': main,
      'other/d/package.json': withStorybook,
      'other/d/.storybook/main.ts': main,
    });

    expect(() =>
      checkUnreadableProjects(
        [readable('packages/a')],
        [unreadable('packages/c'), unreadable('other/d')]
      )
    ).toThrow(HandledError);
    expect(logged('error')).toContain('packages/c/.storybook');
    expect(logged('error')).not.toContain('other/d');
  });

  it('does not stop for a .storybook folder without a main file, and still names it', () => {
    createFixture({
      'package.json': withStorybook,
      'packages/a/package.json': withStorybook,
      'packages/c/package.json': withStorybook,
    });

    checkUnreadableProjects([readable('packages/a')], [unreadable('packages/c')]);

    expect(logged('warn')).toContain('packages/c/.storybook');
  });

  it('does not count a package.json the upgrade would not rewrite, such as one with only @nx/storybook', () => {
    createFixture({
      'package.json': JSON.stringify({ devDependencies: { '@nx/storybook': '20.0.0' } }),
      'packages/a/package.json': withStorybook,
      'packages/c/package.json': withStorybook,
      'packages/c/.storybook/main.ts': main,
    });

    checkUnreadableProjects([readable('packages/a')], [unreadable('packages/c')]);

    expect(logger.error).not.toHaveBeenCalled();
    expect(logged('warn')).toContain('packages/c/.storybook');
  });

  it('names a non-Error throw', () => {
    createFixture({ 'package.json': JSON.stringify({ private: true }) });

    checkUnreadableProjects(
      [readable('packages/a')],
      [{ configDir: join(root, 'packages/c/.storybook'), error: 'x' as unknown as Error }]
    );

    expect(logged('warn')).toMatch(/packages\/c\/\.storybook: x$/);
  });
});
