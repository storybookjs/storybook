import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chmod, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { userInfo } from 'node:os';

import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createRuntimeInstanceRecord,
  writeRuntimeInstanceRecord,
  writeStorybookRuntimeInstanceRecord,
} from './runtime-instance-registry.ts';

// Spy-only mock: keep the real `node:fs/promises` shape and redirect the calls the writer makes to
// `memfs`, so file modes can be asserted without touching the developer's home directory.
vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });
vi.mock('node:child_process', { spy: true });

const REGISTRY_DIR = '/home/tester/.storybook/instances';

beforeEach(async () => {
  vol.reset();
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');

  vi.mocked(chmod).mockImplementation(
    memfs.fs.promises.chmod as unknown as typeof import('node:fs/promises').chmod
  );
  vi.mocked(mkdir).mockImplementation(
    memfs.fs.promises.mkdir as unknown as typeof import('node:fs/promises').mkdir
  );
  vi.mocked(readFile).mockImplementation(
    memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
  );
  vi.mocked(readdir).mockImplementation(
    memfs.fs.promises.readdir as unknown as typeof import('node:fs/promises').readdir
  );
  vi.mocked(rename).mockImplementation(
    memfs.fs.promises.rename as unknown as typeof import('node:fs/promises').rename
  );
  vi.mocked(rm).mockImplementation(
    memfs.fs.promises.rm as unknown as typeof import('node:fs/promises').rm
  );
  vi.mocked(stat).mockImplementation(
    memfs.fs.promises.stat as unknown as typeof import('node:fs/promises').stat
  );
  vi.mocked(writeFile).mockImplementation(
    memfs.fs.promises.writeFile as unknown as typeof import('node:fs/promises').writeFile
  );
  vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
    const callback = args.find((arg) => typeof arg === 'function') as
      | ((error: Error | null, stdout: string, stderr: string) => void)
      | undefined;
    callback?.(null, '', '');
    return { pid: 0 } as ReturnType<typeof execFile>;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function modeOf(path: string) {
  return vol.statSync(path).mode & 0o777;
}

function readRecordFile(path: string) {
  return JSON.parse(vol.readFileSync(path, 'utf-8') as string);
}

describe('writeRuntimeInstanceRecord', () => {
  it('round-trips the channel token through the record file', async () => {
    const record = createRuntimeInstanceRecord({
      address: 'http://localhost:6006/',
      instanceId: 'with-token',
      port: 6006,
      storybookVersion: '10.5.0-alpha.0',
      token: 'a4d1f0c2-1e2b-4c3d-8e9f-0a1b2c3d4e5f',
    });

    const recordPath = await writeRuntimeInstanceRecord(record, REGISTRY_DIR);

    expect(readRecordFile(recordPath)).toMatchObject({
      instanceId: 'with-token',
      token: 'a4d1f0c2-1e2b-4c3d-8e9f-0a1b2c3d4e5f',
    });
  });

  it('omits storybookPath when no storybook package root can be derived', async () => {
    // The derivation walks the real filesystem for a package.json named `storybook`; failing every
    // manifest read makes that walk come up empty.
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const record = createRuntimeInstanceRecord({
      address: 'http://localhost:6006/',
      instanceId: 'rootless',
      port: 6006,
      storybookVersion: '10.5.0-alpha.0',
    });

    const recordPath = await writeRuntimeInstanceRecord(record, REGISTRY_DIR);

    expect(record).not.toHaveProperty('storybookPath');
    expect(readRecordFile(recordPath)).not.toHaveProperty('storybookPath');
  });

  it('omits the token key when no token is provided', async () => {
    const record = createRuntimeInstanceRecord({
      address: 'http://localhost:6006/',
      instanceId: 'without-token',
      port: 6006,
      storybookVersion: '10.5.0-alpha.0',
    });

    const recordPath = await writeRuntimeInstanceRecord(record, REGISTRY_DIR);

    expect(record).not.toHaveProperty('token');
    expect(readRecordFile(recordPath)).not.toHaveProperty('token');
  });

  it('creates the registry dir as 0700 and the record file as 0600', async () => {
    const record = createRuntimeInstanceRecord({
      address: 'http://localhost:6006/',
      instanceId: 'modes',
      port: 6006,
      storybookVersion: '10.5.0-alpha.0',
      token: 'secret-token',
    });

    const recordPath = await writeRuntimeInstanceRecord(record, REGISTRY_DIR);

    expect(modeOf(REGISTRY_DIR)).toBe(0o700);
    expect(modeOf(recordPath)).toBe(0o600);
  });

  it('tightens an already existing world-readable registry dir to 0700', async () => {
    vol.mkdirSync(REGISTRY_DIR, { recursive: true, mode: 0o755 });

    const record = createRuntimeInstanceRecord({
      address: 'http://localhost:6006/',
      instanceId: 'tightened',
      port: 6006,
      storybookVersion: '10.5.0-alpha.0',
    });

    await writeRuntimeInstanceRecord(record, REGISTRY_DIR);

    expect(modeOf(REGISTRY_DIR)).toBe(0o700);
  });

  it('leaves no temp file behind', async () => {
    const record = createRuntimeInstanceRecord({
      address: 'http://localhost:6006/',
      instanceId: 'no-temp',
      port: 6006,
      storybookVersion: '10.5.0-alpha.0',
      token: 'secret-token',
    });

    await writeRuntimeInstanceRecord(record, REGISTRY_DIR);

    expect(Object.keys(vol.toJSON())).toEqual([`${REGISTRY_DIR}/no-temp.json`]);
  });
});

describe('writeStorybookRuntimeInstanceRecord', () => {
  it('writes the supplied token to disk with a 0600 record file', async () => {
    const { record, recordPath } = await writeStorybookRuntimeInstanceRecord({
      address: 'http://localhost:6006/',
      port: 6006,
      registryDir: REGISTRY_DIR,
      registerCleanup: false,
      storybookVersion: '10.5.0-alpha.0',
      token: 'ws-token',
    });

    expect(record.token).toBe('ws-token');
    expect(readRecordFile(recordPath).token).toBe('ws-token');
    expect(modeOf(recordPath)).toBe(0o600);
    expect(modeOf(REGISTRY_DIR)).toBe(0o700);
  });
});

describe('writeRuntimeInstanceRecord on Windows', () => {
  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
  });

  it('restricts the registry dir and record temp file with icacls', async () => {
    const record = createRuntimeInstanceRecord({
      address: 'http://localhost:6006/',
      instanceId: 'win-acl',
      port: 6006,
      storybookVersion: '10.5.0-alpha.0',
      token: 'secret-token',
    });

    const recordPath = await writeRuntimeInstanceRecord(record, REGISTRY_DIR);
    const grant = `${userInfo().username}:(F)`;

    expect(execFile).toHaveBeenCalledWith(
      'icacls',
      [REGISTRY_DIR, '/inheritance:r', '/grant:r', grant],
      expect.any(Function)
    );
    expect(execFile).toHaveBeenCalledWith(
      'icacls',
      expect.arrayContaining([
        expect.stringMatching(/win-acl\..+\.tmp$/),
        '/inheritance:r',
        '/grant:r',
        grant,
      ]),
      expect.any(Function)
    );
    expect(readRecordFile(recordPath).token).toBe('secret-token');
  });
});

describe('writeRuntimeInstanceRecord on Windows when icacls fails', () => {
  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
      const callback = args.find((arg) => typeof arg === 'function') as
        | ((error: Error | null, stdout: string, stderr: string) => void)
        | undefined;
      callback?.(Object.assign(new Error('icacls failed'), { code: 87 }), '', '');
      return { pid: 0 } as ReturnType<typeof execFile>;
    });
  });

  it('does not write a record that other accounts could read', async () => {
    const record = createRuntimeInstanceRecord({
      address: 'http://localhost:6006/',
      instanceId: 'win-acl-fail',
      port: 6006,
      storybookVersion: '10.5.0-alpha.0',
      token: 'secret-token',
    });

    await expect(writeRuntimeInstanceRecord(record, REGISTRY_DIR)).rejects.toThrow(
      `Could not restrict ${REGISTRY_DIR} to the current Windows user. The instance record would be readable by other accounts.`
    );
    expect(Object.keys(vol.toJSON())).toEqual([REGISTRY_DIR]);
  });
});
