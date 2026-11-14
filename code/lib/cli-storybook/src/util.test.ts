import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getProjectRoot } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';
import { UpgradeStorybookConfigDirNotFoundError } from 'storybook/internal/server-errors';

import type { UpgradeOptions } from './upgrade.ts';
import {
  type CollectProjectsSuccessResult,
  findStorybookProjects,
  getProjects,
  handleMultipleProjects,
  shortenPath,
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

describe('shortenPath', () => {
  it('names a path in the project relative to its root, without a leading separator, and the root as .', () => {
    createFixture({});
    const projectRoot = getProjectRoot();

    expect(shortenPath(join(projectRoot, '.storybook'))).toBe('.storybook');
    expect(shortenPath(join(projectRoot, 'web', '.storybook'))).toBe(join('web', '.storybook'));
    expect(shortenPath(projectRoot)).toBe('.');
  });

  it('keeps a relative path, and a path outside the project, as given', () => {
    createFixture({});

    expect(shortenPath(join('packages', 'docs', '.storybook'))).toBe(
      join('packages', 'docs', '.storybook')
    );
    expect(shortenPath(join(dirname(getProjectRoot()), 'elsewhere', '.storybook'))).toBe(
      join(dirname(getProjectRoot()), 'elsewhere', '.storybook')
    );
  });
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

  it('upgrades every project with --yes, without asking which', async () => {
    await expect(handleMultipleProjects(projects, [], configDirs, true)).resolves.toEqual(projects);
    expect(prompt.multiselect).not.toHaveBeenCalled();
  });

  it('asks which projects to upgrade without --yes', async () => {
    vi.mocked(prompt.multiselect).mockResolvedValue(['/repo/b/.storybook']);

    await expect(handleMultipleProjects(projects, [], configDirs, false)).resolves.toEqual([
      projects[1],
    ]);
  });
});
