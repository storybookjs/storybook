import { join, sep } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as find from 'empathic/find';
// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';

import {
  createTestInstanceContext,
  runInTestInstance,
} from '../../../shared/instance-context.test-helpers.ts';
import {
  findProjectRoot,
  getCurrentWorkingDir,
  getProjectRoot,
  normalizeStoryPath,
} from '../paths.ts';

vi.mock('empathic/find');

describe('paths - normalizeStoryPath()', () => {
  it('returns a path starting with "./" unchanged', () => {
    const filename = `.${sep}${join('src', 'Comp.story.js')}`;
    expect(normalizeStoryPath(filename)).toEqual(filename);
  });

  it('returns a path starting with "../" unchanged', () => {
    const filename = join('..', 'src', 'Comp.story.js');
    expect(normalizeStoryPath(filename)).toEqual(filename);
  });

  it('returns a path equal to "." unchanged', () => {
    const filename = '.';
    expect(normalizeStoryPath(filename)).toEqual(filename);
  });

  it('returns a path equal to ".." unchanged', () => {
    const filename = '..';
    expect(normalizeStoryPath(filename)).toEqual(filename);
  });

  it('adds "./" to a normalized relative path', () => {
    const filename = join('src', 'Comp.story.js');
    expect(normalizeStoryPath(filename)).toEqual(`.${sep}${filename}`);
  });

  it('adds "./" to a hidden folder', () => {
    const filename = join('.storybook', 'Comp.story.js');
    expect(normalizeStoryPath(filename)).toEqual(`.${sep}${filename}`);
  });

  it('adds "./" to a hidden file', () => {
    const filename = `.Comp.story.js`;
    expect(normalizeStoryPath(filename)).toEqual(`.${sep}${filename}`);
  });
});

describe('getProjectRoot', () => {
  it('should return the root directory containing a .git directory', () => {
    vi.mocked(find.up).mockImplementation((name) =>
      name === '.git' ? '/path/to/root' : undefined
    );

    expect(slash(getProjectRoot())).toBe('/path/to');
  });

  it('should return the root directory containing a .svn directory if there is no .git directory', () => {
    vi.mocked(find.up).mockImplementation((name) =>
      name === ('.svn' as any) ? '/path/to/root' : undefined
    );

    expect(slash(getProjectRoot())).toBe('/path/to');
  });

  it('should return the directory containing a lock file if there is no .git or .svn directory', () => {
    vi.mocked(find.up).mockReturnValue(undefined);
    vi.mocked(find.any).mockReturnValue('/path/to/root/yarn.lock');

    expect(slash(getProjectRoot())).toBe('/path/to/root');
  });
});

describe('getProjectRoot per instance', () => {
  const repositories = [join('/', 'repo-a'), join('/', 'repo-b')];

  beforeEach(() => {
    vi.mocked(find.any).mockReturnValue(undefined);
    vi.mocked(find.up).mockImplementation((name, options) =>
      name === '.git'
        ? repositories
            .map((repository) => join(repository, '.git'))
            .find((git) => (options?.cwd ?? process.cwd()).startsWith(join(git, '..')))
        : undefined
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    { workingDir: join('/', 'repo-a', 'packages', 'ui'), expected: join('/', 'repo-a') },
    { workingDir: join('/', 'repo-b'), expected: join('/', 'repo-b') },
  ])('finds the root of the instance working in $workingDir', async ({ workingDir, expected }) => {
    const root = await runInTestInstance(getProjectRoot, createTestInstanceContext(workingDir));

    expect(root).toBe(expected);
  });

  it('keeps each instance root apart while both run', async () => {
    const first = createTestInstanceContext(join('/', 'repo-a'));
    const second = createTestInstanceContext(join('/', 'repo-b'));

    const roots = await Promise.all([
      runInTestInstance(getProjectRoot, first),
      runInTestInstance(getProjectRoot, second),
      runInTestInstance(getProjectRoot, first),
    ]);

    expect(roots).toEqual([join('/', 'repo-a'), join('/', 'repo-b'), join('/', 'repo-a')]);
  });

  it('finds the root from the process directory outside an instance, without caching it', () => {
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(join('/', 'repo-b', 'app'));
    const before = [getProjectRoot(), getCurrentWorkingDir()];
    cwd.mockReturnValue(join('/', 'repo-a'));

    expect([...before, getProjectRoot()]).toEqual([
      join('/', 'repo-b'),
      join('/', 'repo-b', 'app'),
      join('/', 'repo-a'),
    ]);
  });

  it('prefers STORYBOOK_PROJECT_ROOT', () => {
    vi.stubEnv('STORYBOOK_PROJECT_ROOT', join('/', 'override'));

    expect(findProjectRoot(join('/', 'repo-a'))).toBe(join('/', 'override'));
  });
});
