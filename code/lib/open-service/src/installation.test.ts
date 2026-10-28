import { realpathSync } from 'node:fs';

import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockNodePath } from './test-support/mock-node-path.ts';
import { checkInstallation } from './installation.ts';

vi.mock('node:fs', { spy: true });
vi.mock('node:path', { spy: true });

const PROJECT_CORE = '/project/node_modules/@storybook/core';
const PROJECT_STORYBOOK = '/project/node_modules/storybook';
const NPX_CORE = '/npx-cache/node_modules/@storybook/core';
const NPX_STORYBOOK = '/npx-cache/node_modules/storybook';
const PRE_SPLIT_STORYBOOK = '/old/node_modules/storybook';
const NO_HOST_STORYBOOK = '/elsewhere/node_modules/storybook';

// Stands in for resolving `@storybook/core` from a `storybook` root, which bypasses `node:fs`.
const deriveCorePath = (storybookPath: string) =>
  ({ [PROJECT_STORYBOOK]: PROJECT_CORE, [NPX_STORYBOOK]: NPX_CORE })[storybookPath];
// Stands in for resolving a child host specifier from a `storybook` root.
const hasChildHost = (storybookPath: string) => storybookPath !== NO_HOST_STORYBOOK;

beforeEach(async () => {
  vol.reset();
  vol.fromNestedJSON({
    [`${PROJECT_CORE}/package.json`]: '{"name":"@storybook/core"}',
    [`${PROJECT_STORYBOOK}/package.json`]: '{"name":"storybook"}',
    [`${NPX_CORE}/package.json`]: '{"name":"@storybook/core"}',
    [`${NPX_STORYBOOK}/package.json`]: '{"name":"storybook"}',
    [`${PRE_SPLIT_STORYBOOK}/package.json`]: '{"name":"storybook"}',
    [`${NO_HOST_STORYBOOK}/package.json`]: '{"name":"storybook"}',
    '/store/core/package.json': '{"name":"@storybook/core"}',
  });
  vol.symlinkSync('/store/core', '/project/linked-core');
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(realpathSync).mockImplementation(
    memfs.fs.realpathSync as unknown as typeof import('node:fs').realpathSync
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkInstallation', () => {
  it.each([
    {
      name: 'the same core installation',
      record: { corePath: PROJECT_CORE, storybookPath: PROJECT_STORYBOOK },
      caller: PROJECT_CORE,
      expected: { ok: true },
    },
    {
      name: 'a symlinked layout of the same core installation',
      record: { corePath: '/project/linked-core' },
      caller: '/store/core',
      expected: { ok: true },
    },
    {
      name: 'a record without corePath, derived from storybookPath',
      record: { storybookPath: PROJECT_STORYBOOK },
      caller: PROJECT_CORE,
      expected: { ok: true },
    },
    {
      name: 'two different core installations',
      record: { corePath: NPX_CORE, storybookPath: NPX_STORYBOOK },
      caller: PROJECT_CORE,
      expected: {
        ok: false,
        reason: 'different-installation',
        callerPath: PROJECT_CORE,
        instancePath: NPX_CORE,
        storybookPath: NPX_STORYBOOK,
      },
    },
    {
      name: 'a different installation derived from storybookPath',
      record: { storybookPath: NPX_STORYBOOK },
      caller: PROJECT_CORE,
      expected: {
        ok: false,
        reason: 'different-installation',
        callerPath: PROJECT_CORE,
        instancePath: NPX_CORE,
        storybookPath: NPX_STORYBOOK,
      },
    },
    {
      name: 'a record that names no installation',
      record: {},
      caller: PROJECT_CORE,
      expected: { ok: false, reason: 'unknown-installation' },
    },
    {
      name: 'a pre-split storybook that runs no core but ships a child host',
      record: { storybookPath: PRE_SPLIT_STORYBOOK },
      caller: PROJECT_CORE,
      expected: {
        ok: false,
        reason: 'different-installation',
        callerPath: PROJECT_CORE,
        storybookPath: PRE_SPLIT_STORYBOOK,
      },
    },
    {
      name: 'a storybookPath with neither a derivable core nor a child host',
      record: { storybookPath: NO_HOST_STORYBOOK },
      caller: PROJECT_CORE,
      expected: { ok: false, reason: 'unknown-installation' },
    },
    {
      name: 'a pre-split storybookPath that no longer exists on disk',
      record: { storybookPath: '/gone/node_modules/storybook' },
      caller: PROJECT_CORE,
      expected: { ok: false, reason: 'unknown-installation' },
    },
    {
      name: 'a recorded core gone from disk next to a storybook with a child host',
      record: {
        corePath: '/gone/node_modules/@storybook/core',
        storybookPath: PRE_SPLIT_STORYBOOK,
      },
      caller: PROJECT_CORE,
      expected: { ok: false, reason: 'unknown-installation' },
    },
    {
      name: 'a recorded core that no longer exists on disk',
      record: { corePath: '/gone/node_modules/@storybook/core' },
      caller: PROJECT_CORE,
      expected: { ok: false, reason: 'unknown-installation' },
    },
    {
      name: 'a caller that cannot derive its own core root',
      record: { corePath: PROJECT_CORE },
      caller: undefined,
      expected: { ok: false, reason: 'unknown-installation' },
    },
  ])('$name', ({ record, caller, expected }) => {
    expect(checkInstallation(record, caller, { deriveCorePath, hasChildHost })).toEqual(expected);
  });

  it('matches Windows paths that differ only by letter case', () => {
    mockNodePath('win32');

    expect(
      checkInstallation({ corePath: PROJECT_CORE }, PROJECT_CORE.toUpperCase(), {
        deriveCorePath,
        hasChildHost,
      })
    ).toEqual({ ok: true });
  });
});
