import { readFile, readdir, rm } from 'node:fs/promises';

import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readRegistry } from './registry.ts';

// Spy-only mock: keep the real `node:fs/promises` module shape, then redirect the calls used by
// the registry reader to `memfs` so disk state stays scoped to `vol`.
vi.mock('node:fs/promises', { spy: true });

const REGISTRY_DIR = '/registry';

beforeEach(async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');

  vi.mocked(readdir).mockImplementation(
    memfs.fs.promises.readdir as unknown as typeof import('node:fs/promises').readdir
  );
  vi.mocked(readFile).mockImplementation(
    memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
  );
  vi.mocked(rm).mockImplementation(
    memfs.fs.promises.rm as unknown as typeof import('node:fs/promises').rm
  );

  // Deterministic PID liveness: in these tests only the current process counts as alive.
  vi.spyOn(process, 'kill').mockImplementation((pid) => {
    if (pid !== process.pid) {
      const error = new Error('ESRCH') as NodeJS.ErrnoException;
      error.code = 'ESRCH';
      throw error;
    }
    return true;
  });
});

afterEach(() => {
  vol.reset();
  vi.restoreAllMocks();
});

const aliveRecord = {
  schemaVersion: 1,
  instanceId: 'alive-uuid',
  pid: process.pid,
  cwd: '/projects/alive',
  url: 'http://localhost:6006',
  port: 6006,
  storybookVersion: '10.5.0',
  startedAt: '2026-05-18T12:00:00.000Z',
  updatedAt: '2026-05-18T12:00:03.000Z',
  mcp: { status: 'ready', endpoint: '/mcp' },
};

describe('readRegistry', () => {
  it('returns [] when the registry dir does not exist', async () => {
    vol.fromNestedJSON({ '/elsewhere': {} });
    await expect(readRegistry('/registry-does-not-exist')).resolves.toEqual([]);
  });

  it('returns [] when the registry dir is empty', async () => {
    vol.fromNestedJSON({ [REGISTRY_DIR]: {} });
    await expect(readRegistry(REGISTRY_DIR)).resolves.toEqual([]);
  });

  it('parses valid records and skips dead PIDs, bad schemas, malformed JSON and non-JSON files', async () => {
    const dead = { ...aliveRecord, instanceId: 'dead-uuid', pid: 2147483646 };
    const unknownStatus = {
      ...aliveRecord,
      instanceId: 'bad-uuid',
      mcp: { status: 'unrecognised', endpoint: '/mcp' },
    };

    vol.fromNestedJSON({
      [REGISTRY_DIR]: {
        'alive.json': JSON.stringify(aliveRecord),
        'dead.json': JSON.stringify(dead),
        'bad-status.json': JSON.stringify(unknownStatus),
        'malformed.json': '{ not json',
        'wrong-shape.json': JSON.stringify({ foo: 'bar' }),
        'ignored.txt': 'should be ignored',
      },
    });

    await expect(readRegistry(REGISTRY_DIR)).resolves.toEqual([aliveRecord]);
  });

  it('removes the registry file of a dead PID', async () => {
    const dead = { ...aliveRecord, instanceId: 'dead-uuid', pid: 2147483646 };
    vol.fromNestedJSON({ [REGISTRY_DIR]: { 'dead.json': JSON.stringify(dead) } });

    await expect(readRegistry(REGISTRY_DIR)).resolves.toEqual([]);
    expect(vol.toJSON()[`${REGISTRY_DIR}/dead.json`]).toBeUndefined();
  });

  it('filters records with non-positive PIDs (process-group sentinels)', async () => {
    vol.fromNestedJSON({
      [REGISTRY_DIR]: {
        'zero.json': JSON.stringify({ ...aliveRecord, instanceId: 'zero', pid: 0 }),
        'negative.json': JSON.stringify({ ...aliveRecord, instanceId: 'neg', pid: -1 }),
      },
    });

    await expect(readRegistry(REGISTRY_DIR)).resolves.toEqual([]);
  });

  it('treats EPERM on the liveness signal as alive (foreign-user process)', async () => {
    vi.mocked(process.kill).mockImplementation(() => {
      const error = new Error('EPERM') as NodeJS.ErrnoException;
      error.code = 'EPERM';
      throw error;
    });
    vol.fromNestedJSON({ [REGISTRY_DIR]: { 'alive.json': JSON.stringify(aliveRecord) } });

    await expect(readRegistry(REGISTRY_DIR)).resolves.toEqual([aliveRecord]);
  });

  it('accepts records without the optional version and timestamp fields', async () => {
    const minimal = {
      schemaVersion: 1,
      instanceId: 'minimal',
      pid: process.pid,
      cwd: '/projects/minimal',
      url: 'http://localhost:6007',
      port: 6007,
      mcp: { status: 'starting' },
    };
    vol.fromNestedJSON({ [REGISTRY_DIR]: { 'minimal.json': JSON.stringify(minimal) } });

    await expect(readRegistry(REGISTRY_DIR)).resolves.toEqual([minimal]);
  });

  it('accepts records with an optional configDir (written by Storybook >= 10.5)', async () => {
    const withConfigDir = { ...aliveRecord, configDir: '/projects/alive/packages/ui/.storybook' };
    vol.fromNestedJSON({
      [REGISTRY_DIR]: { 'config-dir.json': JSON.stringify(withConfigDir) },
    });

    await expect(readRegistry(REGISTRY_DIR)).resolves.toEqual([withConfigDir]);
  });

  it('accepts records with an optional channel token', async () => {
    const withToken = { ...aliveRecord, token: 'a4d1f0c2-1e2b-4c3d-8e9f-0a1b2c3d4e5f' };
    vol.fromNestedJSON({ [REGISTRY_DIR]: { 'token.json': JSON.stringify(withToken) } });

    await expect(readRegistry(REGISTRY_DIR)).resolves.toEqual([withToken]);
  });

  it('accepts records without a token (written by Storybooks that predate it)', async () => {
    vol.fromNestedJSON({ [REGISTRY_DIR]: { 'tokenless.json': JSON.stringify(aliveRecord) } });

    const [record] = await readRegistry(REGISTRY_DIR);

    expect(record).toEqual(aliveRecord);
    expect(record.token).toBeUndefined();
  });

  it('accepts records with an optional storybookPath (written by servers that record their installation)', async () => {
    const withStorybookPath = {
      ...aliveRecord,
      storybookPath: '/projects/alive/node_modules/storybook',
    };
    vol.fromNestedJSON({
      [REGISTRY_DIR]: { 'storybook-path.json': JSON.stringify(withStorybookPath) },
    });

    await expect(readRegistry(REGISTRY_DIR)).resolves.toEqual([withStorybookPath]);
  });

  it('accepts records with optional agent provenance', async () => {
    const agentRecord = { ...aliveRecord, agent: 'claude-preview' };
    vol.fromNestedJSON({ [REGISTRY_DIR]: { 'agent.json': JSON.stringify(agentRecord) } });

    await expect(readRegistry(REGISTRY_DIR)).resolves.toEqual([agentRecord]);
  });

  it('rejects out-of-range ports', async () => {
    vol.fromNestedJSON({
      [REGISTRY_DIR]: {
        'bad-port.json': JSON.stringify({ ...aliveRecord, port: 65536 }),
      },
    });

    await expect(readRegistry(REGISTRY_DIR)).resolves.toEqual([]);
  });
});
