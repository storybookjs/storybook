import { describe, expect, it } from 'vitest';

import { normalizeGitUrl } from './anonymous-id';

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
