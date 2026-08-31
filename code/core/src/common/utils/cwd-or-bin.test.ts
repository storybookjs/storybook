import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  inspectCwdOrBin,
  resolveRecordedCwd,
  resolveStorybookPackageJson,
  workingDirectoryForCwdOrBin,
} from './cwd-or-bin.ts';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = dirname(thisFile);

describe('inspectCwdOrBin', () => {
  it('classifies an existing directory as a directory', () => {
    expect(inspectCwdOrBin(thisDir)).toEqual({ kind: 'directory', path: resolve(thisDir) });
  });

  it('classifies an existing file as a file', () => {
    expect(inspectCwdOrBin(thisFile)).toEqual({ kind: 'file', path: resolve(thisFile) });
  });

  it('classifies a missing path as a directory', () => {
    expect(inspectCwdOrBin('/no-such-storybook-cwd-or-bin')).toEqual({
      kind: 'directory',
      path: resolve('/no-such-storybook-cwd-or-bin'),
    });
  });
});

describe('workingDirectoryForCwdOrBin', () => {
  it('returns the path when it is a directory', () => {
    expect(workingDirectoryForCwdOrBin(thisDir)).toBe(resolve(thisDir));
  });

  it('uses dirname(configDir) when the path is a file', () => {
    expect(workingDirectoryForCwdOrBin(thisFile, '/repo/.storybook')).toBe(resolve('/repo'));
  });

  it('falls back to process.cwd() when the path is a file and no configDir is given', () => {
    expect(workingDirectoryForCwdOrBin(thisFile)).toBe(process.cwd());
  });
});

describe('resolveRecordedCwd', () => {
  it('keeps a process cwd that can resolve the storybook package', () => {
    expect(
      resolveRecordedCwd({
        processCwd: process.cwd(),
        invokedPath: thisFile,
      })
    ).toBe(resolve(process.cwd()));
  });

  it('records the invoked storybook file when the process cwd cannot resolve storybook', () => {
    expect(
      resolveRecordedCwd({
        processCwd: '/no-such-storybook-project-cwd-or-bin',
        invokedPath: thisFile,
      })
    ).toBe(resolve(thisFile));
    expect(resolveStorybookPackageJson(thisFile)).toEqual(expect.stringContaining('package.json'));
  });

  it('falls back to the process cwd when neither the cwd nor the invoked path resolve storybook', () => {
    expect(
      resolveRecordedCwd({
        processCwd: '/no-such-storybook-project-cwd-or-bin',
        invokedPath: '/no-such-storybook-bin',
        fallbackFile: '/no-such-storybook-fallback',
      })
    ).toBe(resolve('/no-such-storybook-project-cwd-or-bin'));
  });
});
