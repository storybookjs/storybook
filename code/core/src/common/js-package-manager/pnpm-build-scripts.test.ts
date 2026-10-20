import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';

import {
  hasAllowBuildsDecision,
  hasPnpm10ListDecision,
  listsPackage,
  matchesPackage,
  readOnlyBuiltDependenciesFile,
} from './pnpm-build-scripts.ts';

vi.mock('node:fs', { spy: true });

describe('matchesPackage', () => {
  it.each([
    ['esbuild', true],
    ['esbuild@0.25.0', true],
    ['esbuild@0.25.0 || 0.25.1', true],
    ['esbuild@git+ssh://git@example.com/esbuild.git', true],
    ['esbuild-wasm', false],
    ['esbuild-wasm@1.0.0', false],
    ['@scope/esbuild', false],
    [42, false],
    [null, false],
  ])('%j matches esbuild: %s', (value, expected) => {
    expect(matchesPackage(value, 'esbuild')).toBe(expected);
  });
});

describe('listsPackage', () => {
  it('finds a bare or pinned entry', () => {
    expect(listsPackage(['sharp', 'esbuild@0.25.0'], 'esbuild')).toBe(true);
  });

  it('is false for a list of other packages, or anything that is not a list', () => {
    expect(listsPackage(['sharp', 'esbuild-wasm'], 'esbuild')).toBe(false);
    expect(listsPackage('esbuild', 'esbuild')).toBe(false);
    expect(listsPackage(undefined, 'esbuild')).toBe(false);
  });
});

describe('hasAllowBuildsDecision', () => {
  it.each([
    ['an approval', { allowBuilds: { esbuild: true } }],
    ['a denial', { allowBuilds: { esbuild: false } }],
    ['a version-pinned entry', { allowBuilds: { 'esbuild@0.25.0 || 0.25.1': false } }],
    ['dangerouslyAllowAllBuilds', { dangerouslyAllowAllBuilds: true }],
  ])('is true for %s', (_, settings) => {
    expect(hasAllowBuildsDecision(settings, 'esbuild')).toBe(true);
  });

  it.each([
    [
      'the placeholder pnpm writes for an unreviewed package',
      { allowBuilds: { esbuild: 'set this to true or false' } },
    ],
    ['entries for other packages', { allowBuilds: { sharp: true, 'esbuild-wasm@1.0.0': true } }],
    ['an empty allowBuilds key', { allowBuilds: null }],
    ['allowBuilds that is not a map', { allowBuilds: ['esbuild'] }],
    ['dangerouslyAllowAllBuilds set to false', { dangerouslyAllowAllBuilds: false }],
    ['no settings', undefined],
  ])('is false for %s', (_, settings) => {
    expect(hasAllowBuildsDecision(settings, 'esbuild')).toBe(false);
  });
});

describe('readOnlyBuiltDependenciesFile', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
  });

  it('reads the list relative to the workspace directory', () => {
    vol.fromJSON({ '/root/trusted/allow.json': '["@swc/core", "esbuild@0.25.0"]' });

    expect(readOnlyBuiltDependenciesFile('trusted/allow.json', '/root')).toEqual([
      '@swc/core',
      'esbuild@0.25.0',
    ]);
  });

  it.each([
    ['the setting is absent', undefined, {}],
    ['the file is missing', 'trusted/allow.json', {}],
    ['the file is not JSON', 'trusted/allow.json', { '/root/trusted/allow.json': '[' }],
    [
      'the file holds no list',
      'trusted/allow.json',
      { '/root/trusted/allow.json': '{"esbuild": true}' },
    ],
  ])('lists nothing when %s', (_, file, files) => {
    vol.fromJSON(files);

    expect(readOnlyBuiltDependenciesFile(file, '/root')).toEqual([]);
  });
});

describe('hasPnpm10ListDecision', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
  });

  it.each([
    ['onlyBuiltDependencies names the package', { onlyBuiltDependencies: ['esbuild'] }],
    ['ignoredBuiltDependencies pins the package', { ignoredBuiltDependencies: ['esbuild@0.25.0'] }],
    ['neverBuiltDependencies names the package', { neverBuiltDependencies: ['esbuild'] }],
    ['neverBuiltDependencies names only other packages', { neverBuiltDependencies: ['fsevents'] }],
    ['neverBuiltDependencies is empty', { neverBuiltDependencies: [] }],
  ])('is true when %s', (_, settings) => {
    expect(hasPnpm10ListDecision(settings, 'esbuild', '/root')).toBe(true);
  });

  it('is true when the trusted-dependencies file names the package', () => {
    vol.fromJSON({ '/root/trusted/allow.json': '["esbuild"]' });

    expect(
      hasPnpm10ListDecision({ onlyBuiltDependenciesFile: 'trusted/allow.json' }, 'esbuild', '/root')
    ).toBe(true);
  });

  it.each([
    [
      'the lists name only other packages',
      { onlyBuiltDependencies: ['sharp'], ignoredBuiltDependencies: ['fsevents'] },
    ],
    [
      'the trusted-dependencies file names only other packages',
      { onlyBuiltDependenciesFile: 'trusted/allow.json' },
    ],
    ['only allowBuilds is set', { allowBuilds: { esbuild: true } }],
    ['no settings', undefined],
  ])('is false when %s', (_, settings) => {
    vol.fromJSON({ '/root/trusted/allow.json': '["sharp"]' });

    expect(hasPnpm10ListDecision(settings, 'esbuild', '/root')).toBe(false);
  });
});
