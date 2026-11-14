import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { HandledError, JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
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
} from './util.ts';

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
  rmSync(root, { recursive: true, force: true });
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

describe('checkUnreadableProjects', () => {
  const withStorybook = JSON.stringify({ devDependencies: { storybook: '10.6.7' } });
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
      error: new Error("Cannot find module 'shared/vite' imported from main.ts\n    at stack"),
    }),
  });

  it('changes nothing when an unreadable project shares a package.json with the others', () => {
    createFixture({
      'package.json': withStorybook,
      'packages/a/package.json': withStorybook,
      'packages/c/package.json': withStorybook,
    });
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    expect(() =>
      checkUnreadableProjects([readable('packages/a')], [unreadable('packages/c')])
    ).toThrow(HandledError);
    expect(vi.mocked(logger.error).mock.calls[0][0]).toContain(
      ": Cannot find module 'shared/vite' imported from main.ts\nFix them and run the upgrade again. To upgrade only the others, which still upgrades the shared package.json and leaves these projects behind: npx storybook upgrade --config-dir "
    );
    expect(vi.mocked(logger.error).mock.calls[0][0]).toMatch(
      /--config-dir \S*packages\/a\/\.storybook$/
    );
  });

  it('goes on with separate Storybooks, and names the one it leaves and why', () => {
    createFixture({
      'package.json': JSON.stringify({ private: true }),
      'packages/a/package.json': withStorybook,
      'packages/c/package.json': withStorybook,
    });
    vi.spyOn(logger, 'warn').mockImplementation(() => {});

    checkUnreadableProjects([readable('packages/a')], [unreadable('packages/c')]);

    expect(vi.mocked(logger.warn).mock.calls[0][0]).toMatch(
      /^Not upgrading these Storybook projects, because Storybook could not read them:\n.*packages\/c\/\.storybook: Cannot find module 'shared\/vite' imported from main\.ts$/
    );
  });
});
