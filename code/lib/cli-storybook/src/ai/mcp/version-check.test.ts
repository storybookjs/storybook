import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  STORYBOOK_MIN_VERSION,
  checkStorybookVersion,
  classifyStorybookVersion,
} from './version-check.ts';

vi.mock('node:module', { spy: true });

// Spy-only mock: redirect the version reader's readFileSync to memfs.
vi.mock('node:fs', { spy: true });

describe('classifyStorybookVersion (pure)', () => {
  it('returns ok for the minimum version', () => {
    expect(classifyStorybookVersion(STORYBOOK_MIN_VERSION)).toEqual({ status: 'ok' });
  });

  it('returns ok for a stable release above the minimum', () => {
    expect(classifyStorybookVersion('10.6.2')).toEqual({ status: 'ok' });
  });

  it('accepts any prerelease of the minimum (alpha/beta/rc)', () => {
    expect(classifyStorybookVersion('10.5.0-alpha.3')).toEqual({ status: 'ok' });
  });

  it('returns too-old for a version below the floor', () => {
    expect(classifyStorybookVersion('9.1.16')).toEqual({ status: 'too-old', version: '9.1.16' });
  });

  it('treats a prerelease of an earlier version as too-old', () => {
    expect(classifyStorybookVersion('10.4.0-rc.1')).toEqual({
      status: 'too-old',
      version: '10.4.0-rc.1',
    });
  });

  it('returns not-installed for undefined', () => {
    expect(classifyStorybookVersion(undefined)).toEqual({ status: 'not-installed' });
  });

  it('treats 0.0.0-... versions as ok (canary)', () => {
    expect(classifyStorybookVersion('0.0.0-canary.1234')).toEqual({ status: 'ok' });
  });
});

describe('checkStorybookVersion (disk lookup)', () => {
  function mockSearchPaths(paths: string[]) {
    vi.mocked(createRequire).mockReturnValue({
      resolve: Object.assign(() => '', { paths: () => paths }),
    } as unknown as ReturnType<typeof createRequire>);
  }

  beforeEach(async () => {
    const memfs = await vi.importActual<typeof import('memfs')>('memfs');
    vi.mocked(readFileSync).mockImplementation(
      memfs.fs.readFileSync as unknown as typeof import('node:fs').readFileSync
    );
  });

  afterEach(() => {
    vol.reset();
    vi.mocked(createRequire).mockReset();
  });

  it('reads the version from the first search path holding a storybook package', () => {
    mockSearchPaths(['/proj/node_modules', '/node_modules']);
    vol.fromNestedJSON({
      '/proj/node_modules/storybook/package.json': JSON.stringify({ version: '10.5.0' }),
    });
    expect(checkStorybookVersion('/proj')).toEqual({ status: 'ok' });
  });

  it('walks up the search paths until storybook resolves (monorepo hoisting)', () => {
    mockSearchPaths(['/repo/packages/app/node_modules', '/repo/node_modules']);
    vol.fromNestedJSON({
      '/repo/node_modules/storybook/package.json': JSON.stringify({ version: '9.1.16' }),
    });
    expect(checkStorybookVersion('/repo/packages/app')).toEqual({
      status: 'too-old',
      version: '9.1.16',
    });
  });

  it('returns not-installed when no search path holds storybook', () => {
    mockSearchPaths(['/proj/node_modules']);
    vol.fromNestedJSON({ '/proj/node_modules': {} });
    expect(checkStorybookVersion('/proj')).toEqual({ status: 'not-installed' });
  });

  it('skips malformed package.json files and keeps searching', () => {
    mockSearchPaths(['/a/node_modules', '/b/node_modules']);
    vol.fromNestedJSON({
      '/a/node_modules/storybook/package.json': '{ not json',
      '/b/node_modules/storybook/package.json': JSON.stringify({ version: '10.5.0' }),
    });
    expect(checkStorybookVersion('/a')).toEqual({ status: 'ok' });
  });

  it('treats a package.json without a string version as not-installed', () => {
    mockSearchPaths(['/proj/node_modules']);
    vol.fromNestedJSON({
      '/proj/node_modules/storybook/package.json': JSON.stringify({ name: 'storybook' }),
    });
    expect(checkStorybookVersion('/proj')).toEqual({ status: 'not-installed' });
  });
});
