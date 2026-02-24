import { describe, expect, it, vi } from 'vitest';

import { execSync } from 'child_process';

import { getProjectSince, normalizeGitUrl, unhashedProjectId } from './anonymous-id';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

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
  it('returns a Date from git log output', () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from('2024-06-15 18:23:01 +0000\n'));

    expect(getProjectSince()).toEqual(new Date('2024-06-15 18:23:01 +0000'));
    expect(vi.mocked(execSync)).toHaveBeenCalledWith('git log --reverse --format=%cd --date=iso', {
      timeout: 1000,
      stdio: 'pipe',
    });
  });

  it('returns undefined if git log output is empty', () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from('   \n'));

    expect(getProjectSince()).toBeUndefined();
  });

  it('returns undefined if git log fails', () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('git not available');
    });

    expect(getProjectSince()).toBeUndefined();
  });
});
