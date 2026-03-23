import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeCommandSync } from 'storybook/internal/common';

import {
  getAnonymousProjectId,
  getProjectSince,
  normalizeGitUrl,
  unhashedProjectId,
} from './anonymous-id';

vi.mock(import('storybook/internal/common'), async (actualModule) => {
  const actual = await actualModule();

  return {
    ...actual,
    executeCommandSync: vi.fn(actual.executeCommandSync),
    getProjectRoot: () => '/path/to/project/root',
  };
});

beforeEach(() => {
  vi.mocked(executeCommandSync).mockReset();
});

describe('normalizeGitUrl', () => {
  it('trims off https://', () => {
    expect(normalizeGitUrl('https://github.com/storybookjs/storybook.git')).toEqual(
      'github.com/storybookjs/storybook.git'
    );
  });

  it('trims off http://', () => {
    expect(normalizeGitUrl('http://github.com/storybookjs/storybook.git')).toEqual(
      'github.com/storybookjs/storybook.git'
    );
  });

  it('trims off git+https://', () => {
    expect(normalizeGitUrl('git+https://github.com/storybookjs/storybook.git')).toEqual(
      'github.com/storybookjs/storybook.git'
    );
  });

  it('trims off https://username@', () => {
    expect(normalizeGitUrl('https://username@github.com/storybookjs/storybook.git')).toEqual(
      'github.com/storybookjs/storybook.git'
    );
  });

  it('trims off http://username@', () => {
    expect(normalizeGitUrl('http://username@github.com/storybookjs/storybook.git')).toEqual(
      'github.com/storybookjs/storybook.git'
    );
  });

  it('trims off https://username:password@', () => {
    expect(
      normalizeGitUrl('https://username:password@github.com/storybookjs/storybook.git')
    ).toEqual('github.com/storybookjs/storybook.git');
  });

  it('trims off http://username:password@', () => {
    expect(
      normalizeGitUrl('http://username:password@github.com/storybookjs/storybook.git')
    ).toEqual('github.com/storybookjs/storybook.git');
  });

  it('trims off git://', () => {
    expect(normalizeGitUrl('git://github.com/storybookjs/storybook.git')).toEqual(
      'github.com/storybookjs/storybook.git'
    );
  });

  it('trims off git@', () => {
    expect(normalizeGitUrl('git@github.com:storybookjs/storybook.git')).toEqual(
      'github.com/storybookjs/storybook.git'
    );
  });

  it('trims off git+ssh://git@', () => {
    expect(normalizeGitUrl('git+ssh://git@github.com:storybookjs/storybook.git')).toEqual(
      'github.com/storybookjs/storybook.git'
    );
  });

  it('trims off ssh://git@', () => {
    expect(normalizeGitUrl('ssh://git@github.com:storybookjs/storybook.git')).toEqual(
      'github.com/storybookjs/storybook.git'
    );
  });

  it('adds .git if missing', () => {
    expect(normalizeGitUrl('https://github.com/storybookjs/storybook')).toEqual(
      'github.com/storybookjs/storybook.git'
    );
  });

  it('trims off #hash', () => {
    expect(normalizeGitUrl('https://github.com/storybookjs/storybook.git#next')).toEqual(
      'github.com/storybookjs/storybook.git'
    );
  });

  it('trims off extra whitespace', () => {
    expect(normalizeGitUrl('https://github.com/storybookjs/storybook.git#next\n')).toEqual(
      'github.com/storybookjs/storybook.git'
    );

    expect(normalizeGitUrl('https://github.com/storybookjs/storybook.git\n')).toEqual(
      'github.com/storybookjs/storybook.git'
    );
  });
});

describe('unhashedProjectId', () => {
  it('does not touch unix paths', () => {
    expect(
      unhashedProjectId('https://github.com/storybookjs/storybook.git\n', 'path/to/storybook')
    ).toBe('github.com/storybookjs/storybook.gitpath/to/storybook');
  });

  it('normalizes windows paths', () => {
    expect(
      unhashedProjectId('https://github.com/storybookjs/storybook.git\n', 'path\\to\\storybook')
    ).toBe('github.com/storybookjs/storybook.gitpath/to/storybook');
  });
});

describe('getProjectSince', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns the Storybook creation date from git log output', () => {
    vi.mocked(executeCommandSync).mockReturnValue(
      '2025-12-11 16:24:01 +0530\n' + '2014-12-11 19:09:10 +0530'
    );

    expect(getProjectSince()).toEqual(new Date('2025-12-11T10:54:01.000Z'));
  });

  it('returns undefined if git log output is empty', async () => {
    vi.mocked(executeCommandSync).mockReturnValue('');

    const { getProjectSince: getProjSince } = await import('./anonymous-id');

    expect(getProjSince()).toBeUndefined();
  });

  it('returns undefined if git log fails', async () => {
    vi.mocked(executeCommandSync).mockImplementation(() => {
      throw new Error('git not available');
    });

    const { getProjectSince: getProjSince } = await import('./anonymous-id');

    expect(getProjSince()).toBeUndefined();
  });
});

describe('getAnonymousProjectId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.spyOn(process, 'cwd').mockReturnValue('/path/to/project/root');
  });

  it('returns hashed project id for Storybook repo when git command succeeds', async () => {
    vi.mocked(executeCommandSync).mockReturnValue('git@github.com:storybookjs/storybook.git');
    const result = getAnonymousProjectId();

    expect(result).toMatch('061e4ee22a1f7c079849d97234b3be94d016fb1f24ba11878c41f8b48c0213bf');
  });

  it('returns undefined when git command fails', async () => {
    const { getAnonymousProjectId: getAnonId } = await import('./anonymous-id');

    vi.mocked(executeCommandSync).mockImplementation(() => {
      throw new Error('git not available');
    });

    const result = getAnonId();

    expect(result).toBeUndefined();
  });
});
