import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  resolveChildHostScript,
  resolveProjectStorybookVersion,
} from './resolve-project-storybook.ts';

const thisFile = fileURLToPath(import.meta.url);

describe('resolveProjectStorybookVersion', () => {
  it('resolves the storybook version from a project directory', () => {
    expect(resolveProjectStorybookVersion(process.cwd())).toEqual(expect.any(String));
  });

  it('resolves the storybook version from a file inside the storybook package', () => {
    expect(resolveProjectStorybookVersion(thisFile)).toBe(
      resolveProjectStorybookVersion(process.cwd())
    );
  });

  it('returns undefined when neither a directory nor a file can resolve storybook', () => {
    expect(resolveProjectStorybookVersion('/no-such-storybook-project-or-bin')).toBeUndefined();
  });
});

describe('resolveChildHostScript', () => {
  it('resolves the child-host entry from a project directory', () => {
    expect(resolveChildHostScript(process.cwd())).toEqual(expect.stringContaining('child-host'));
  });

  it('resolves the child-host entry from a file inside the storybook package', () => {
    expect(resolveChildHostScript(thisFile)).toBe(resolveChildHostScript(process.cwd()));
  });
});
