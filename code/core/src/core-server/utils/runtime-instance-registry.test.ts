import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';

import { join, resolve } from 'pathe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createRuntimeInstanceRecord,
  getRuntimeInstanceRegistryCleanupDecision,
  getMcpMetadataFromMainConfig,
  writeRuntimeInstanceRecord,
  writeStorybookRuntimeInstanceRecord,
} from './runtime-instance-registry.ts';

const tempDirs: string[] = [];
const NOW = new Date('2026-06-02T12:00:00.000Z');

function makeTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'storybook-runtime-registry-'));
  tempDirs.push(dir);
  return dir;
}

function hoursAgo(hours: number) {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000);
}

function daysAgo(days: number) {
  return hoursAgo(days * 24);
}

function writeRecordFile({
  instanceId,
  mtime,
  pid = 12345,
  registryDir,
  startedAt,
  updatedAt,
}: {
  instanceId: string;
  mtime?: Date;
  pid?: number;
  registryDir: string;
  startedAt?: string;
  updatedAt?: string;
}) {
  const record = createRuntimeInstanceRecord({
    address: 'http://localhost:6006/',
    instanceId,
    now: NOW,
    pid,
    port: 6006,
    storybookVersion: '10.5.0-alpha.0',
  });
  const recordPath = join(registryDir, `${instanceId}.json`);

  writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        ...record,
        ...(startedAt === undefined ? {} : { startedAt }),
        ...(updatedAt === undefined ? {} : { updatedAt }),
      },
      null,
      2
    )}\n`,
    'utf-8'
  );

  if (mtime) {
    utimesSync(recordPath, mtime, mtime);
  }

  return recordPath;
}

async function writeCurrentRecord(registryDir: string) {
  return writeRuntimeInstanceRecord(
    createRuntimeInstanceRecord({
      address: 'http://localhost:7007/',
      instanceId: 'current-instance',
      now: NOW,
      pid: 7007,
      port: 7007,
      storybookVersion: '10.5.0-alpha.0',
    }),
    registryDir
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();

  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe('getMcpMetadataFromMainConfig', () => {
  it('marks MCP as not-installed when addon-mcp is not configured', () => {
    expect(getMcpMetadataFromMainConfig({ addons: ['@storybook/addon-docs'] })).toEqual({
      status: 'not-installed',
    });
  });

  it('uses the default endpoint when addon-mcp is configured as a string', () => {
    expect(getMcpMetadataFromMainConfig({ addons: ['@storybook/addon-mcp'] })).toEqual({
      status: 'ready',
      endpoint: '/mcp',
    });
  });

  it('uses endpoint from addon-mcp options', () => {
    expect(
      getMcpMetadataFromMainConfig({
        addons: [{ name: '@storybook/addon-mcp', options: { endpoint: '/custom-mcp' } }],
      })
    ).toEqual({
      status: 'ready',
      endpoint: '/custom-mcp',
    });
  });

  it('detects addon-mcp registered as an absolute path via getAbsolutePath()', () => {
    expect(
      getMcpMetadataFromMainConfig({
        addons: ['/Users/me/project/node_modules/@storybook/addon-mcp'],
      })
    ).toEqual({
      status: 'ready',
      endpoint: '/mcp',
    });
  });

  it('detects addon-mcp registered as an object whose name is an absolute path', () => {
    expect(
      getMcpMetadataFromMainConfig({
        addons: [
          {
            name: '/Users/me/project/node_modules/@storybook/addon-mcp',
            options: { endpoint: '/custom-mcp' },
          },
        ],
      })
    ).toEqual({
      status: 'ready',
      endpoint: '/custom-mcp',
    });
  });

  it('detects addon-mcp from a Windows-style absolute path', () => {
    expect(
      getMcpMetadataFromMainConfig({
        addons: ['C:\\project\\node_modules\\@storybook\\addon-mcp'],
      })
    ).toEqual({
      status: 'ready',
      endpoint: '/mcp',
    });
  });

  it('does not match unrelated addons that merely contain the addon-mcp name as a substring', () => {
    expect(
      getMcpMetadataFromMainConfig({
        addons: ['@storybook/addon-mcp-extras', 'storybook-addon-mcp'],
      })
    ).toEqual({
      status: 'not-installed',
    });
  });
});

describe('createRuntimeInstanceRecord', () => {
  const baseOptions = {
    address: 'http://localhost:6006/?path=/docs/button--primary',
    instanceId: '00000000-0000-4000-8000-000000000000',
    now: new Date('2026-05-18T12:00:00.000Z'),
    pid: 12345,
    port: 6006,
    storybookVersion: '10.5.0-alpha.0',
  };

  it('creates a schemaVersion 1 runtime instance record', () => {
    const cwd = join(tmpdir(), 'storybook-project', '..', 'storybook-project');

    expect(createRuntimeInstanceRecord({ ...baseOptions, cwd })).toEqual({
      schemaVersion: 1,
      instanceId: '00000000-0000-4000-8000-000000000000',
      pid: 12345,
      cwd: resolve(cwd),
      url: 'http://localhost:6006',
      port: 6006,
      storybookVersion: '10.5.0-alpha.0',
      startedAt: '2026-05-18T12:00:00.000Z',
      updatedAt: '2026-05-18T12:00:00.000Z',
      mcp: { status: 'not-installed' },
    });
  });

  it('marks MCP as not-installed by default', () => {
    const record = createRuntimeInstanceRecord(baseOptions);

    expect(record.mcp).toEqual({ status: 'not-installed' });
    expect(record.mcp).not.toHaveProperty('endpoint');
  });

  it('uses provided MCP state', () => {
    const record = createRuntimeInstanceRecord({
      ...baseOptions,
      address: 'http://localhost:7007/?path=/story/example--primary',
      mcp: { status: 'ready', endpoint: '/storybook-mcp' },
      port: 7007,
    });

    expect(record.mcp).toEqual({
      status: 'ready',
      endpoint: '/storybook-mcp',
    });
  });

  it('stores provided agent provenance', () => {
    const record = createRuntimeInstanceRecord({
      ...baseOptions,
      agent: 'codex',
    });

    expect(record.agent).toBe('codex');
  });

  it('stores only the Storybook origin in url and excludes initial path query params', () => {
    const record = createRuntimeInstanceRecord({
      ...baseOptions,
      address: 'https://localhost:8008/?path=/story/example--primary',
      port: 8008,
    });

    expect(record.url).toBe('https://localhost:8008');
    expect(record.mcp).toEqual({ status: 'not-installed' });
  });
});

describe('getRuntimeInstanceRegistryCleanupDecision', () => {
  const recentRecord = createRuntimeInstanceRecord({
    address: 'http://localhost:6006/',
    instanceId: 'recent-instance',
    now: NOW,
    pid: 12345,
    port: 6006,
    storybookVersion: '10.5.0-alpha.0',
  });

  it.each([
    {
      name: 'keeps temp files newer than a day',
      entry: {
        kind: 'temp-file' as const,
        fileModifiedAtMs: hoursAgo(23).getTime(),
        nowMs: NOW.getTime(),
      },
      expected: { action: 'keep' },
    },
    {
      name: 'removes temp files older than a day',
      entry: {
        kind: 'temp-file' as const,
        fileModifiedAtMs: daysAgo(2).getTime(),
        nowMs: NOW.getTime(),
      },
      expected: { action: 'remove' },
    },
    {
      name: 'keeps malformed JSON newer than seven days',
      entry: {
        kind: 'malformed-json' as const,
        fileModifiedAtMs: daysAgo(6).getTime(),
        nowMs: NOW.getTime(),
      },
      expected: { action: 'keep' },
    },
    {
      name: 'removes malformed JSON older than seven days',
      entry: {
        kind: 'malformed-json' as const,
        fileModifiedAtMs: daysAgo(8).getTime(),
        nowMs: NOW.getTime(),
      },
      expected: { action: 'remove' },
    },
    {
      name: 'keeps valid records newer than a day',
      entry: {
        kind: 'record' as const,
        fileModifiedAtMs: daysAgo(8).getTime(),
        nowMs: NOW.getTime(),
        record: { ...recentRecord, updatedAt: hoursAgo(23).toISOString() },
      },
      expected: { action: 'keep' },
    },
    {
      name: 'checks the PID for valid records from a day through seven days old',
      entry: {
        kind: 'record' as const,
        fileModifiedAtMs: daysAgo(8).getTime(),
        nowMs: NOW.getTime(),
        record: { ...recentRecord, pid: 202, updatedAt: hoursAgo(24).toISOString() },
      },
      expected: { action: 'check-pid', pid: 202 },
    },
    {
      name: 'keeps stale valid records without a usable PID',
      entry: {
        kind: 'record' as const,
        fileModifiedAtMs: daysAgo(8).getTime(),
        nowMs: NOW.getTime(),
        record: { ...recentRecord, pid: 0, updatedAt: daysAgo(2).toISOString() },
      },
      expected: { action: 'keep' },
    },
    {
      name: 'removes valid records older than seven days',
      entry: {
        kind: 'record' as const,
        fileModifiedAtMs: hoursAgo(1).getTime(),
        nowMs: NOW.getTime(),
        record: { ...recentRecord, updatedAt: daysAgo(8).toISOString() },
      },
      expected: { action: 'remove' },
    },
    {
      name: 'falls back from updatedAt to startedAt',
      entry: {
        kind: 'record' as const,
        fileModifiedAtMs: hoursAgo(1).getTime(),
        nowMs: NOW.getTime(),
        record: {
          ...recentRecord,
          startedAt: daysAgo(8).toISOString(),
          updatedAt: 'not-a-date',
        },
      },
      expected: { action: 'remove' },
    },
    {
      name: 'falls back to file mtime when record timestamps are invalid',
      entry: {
        kind: 'record' as const,
        fileModifiedAtMs: daysAgo(8).getTime(),
        nowMs: NOW.getTime(),
        record: { ...recentRecord, startedAt: 'not-a-date', updatedAt: 'not-a-date' },
      },
      expected: { action: 'remove' },
    },
  ])('$name', ({ entry, expected }) => {
    expect(getRuntimeInstanceRegistryCleanupDecision(entry)).toEqual(expected);
  });
});

describe('writeRuntimeInstanceRecord', () => {
  it('writes via a temporary file in the registry directory and renames to the final JSON path', async () => {
    const registryDir = makeTempDir();
    const record = createRuntimeInstanceRecord({
      address: 'http://localhost:6006/',
      instanceId: '00000000-0000-4000-8000-000000000001',
      now: new Date('2026-05-18T12:00:00.000Z'),
      pid: 12345,
      port: 6006,
      storybookVersion: '10.5.0-alpha.0',
    });

    const recordPath = await writeRuntimeInstanceRecord(record, registryDir);

    expect(recordPath).toBe(join(registryDir, `${record.instanceId}.json`));
    expect(readdirSync(registryDir)).toEqual([`${record.instanceId}.json`]);
    expect(JSON.parse(readFileSync(recordPath, 'utf-8'))).toEqual(record);
  });

  it('sweeps stale registry entries before writing the current record', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const registryDir = makeTempDir();
    writeRecordFile({
      instanceId: 'recent-valid',
      pid: 101,
      registryDir,
      updatedAt: hoursAgo(23).toISOString(),
    });
    writeRecordFile({
      instanceId: 'stale-inactive',
      pid: 202,
      registryDir,
      updatedAt: hoursAgo(24).toISOString(),
    });
    writeRecordFile({
      instanceId: 'stale-active',
      pid: 303,
      registryDir,
      updatedAt: daysAgo(2).toISOString(),
    });
    writeRecordFile({
      instanceId: 'stale-ambiguous',
      pid: 404,
      registryDir,
      updatedAt: daysAgo(2).toISOString(),
    });
    writeRecordFile({
      instanceId: 'old-valid',
      pid: 505,
      registryDir,
      updatedAt: daysAgo(8).toISOString(),
    });
    writeFileSync(join(registryDir, 'recent-malformed.json'), '{', 'utf-8');
    writeFileSync(join(registryDir, 'old-malformed.json'), '{', 'utf-8');
    writeFileSync(join(registryDir, 'recent.tmp'), '{}', 'utf-8');
    writeFileSync(join(registryDir, 'old.tmp'), '{}', 'utf-8');
    utimesSync(join(registryDir, 'recent-malformed.json'), daysAgo(6), daysAgo(6));
    utimesSync(join(registryDir, 'old-malformed.json'), daysAgo(8), daysAgo(8));
    utimesSync(join(registryDir, 'recent.tmp'), hoursAgo(23), hoursAgo(23));
    utimesSync(join(registryDir, 'old.tmp'), daysAgo(2), daysAgo(2));

    const killSpy = vi.spyOn(process, 'kill').mockImplementation((pid) => {
      if (pid === 202) {
        throw Object.assign(new Error('missing process'), { code: 'ESRCH' });
      }

      if (pid === 404) {
        throw Object.assign(new Error('permission denied'), { code: 'EPERM' });
      }

      return true;
    });

    await writeCurrentRecord(registryDir);

    expect(readdirSync(registryDir).sort()).toEqual([
      'current-instance.json',
      'recent-malformed.json',
      'recent-valid.json',
      'recent.tmp',
      'stale-active.json',
      'stale-ambiguous.json',
    ]);
    expect(killSpy.mock.calls.map(([pid]) => pid).sort()).toEqual([202, 303, 404]);
  });

  it('does not block writing the current record when one stale file cannot be removed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const registryDir = makeTempDir();
    const lockedRecordPath = writeRecordFile({
      instanceId: 'locked-instance',
      registryDir,
      updatedAt: daysAgo(8).toISOString(),
    });
    const actualFsPromises =
      await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');

    vi.resetModules();
    vi.doMock('node:fs/promises', () => ({
      ...actualFsPromises,
      rm: vi.fn(async (path, options) => {
        if (path === lockedRecordPath) {
          throw Object.assign(new Error('locked'), { code: 'EBUSY' });
        }

        return actualFsPromises.rm(path, options);
      }),
    }));

    try {
      const {
        createRuntimeInstanceRecord: createRuntimeInstanceRecordWithMockedFs,
        writeRuntimeInstanceRecord: writeRuntimeInstanceRecordWithMockedFs,
      } = await import('./runtime-instance-registry.ts');
      const currentRecordPath = await writeRuntimeInstanceRecordWithMockedFs(
        createRuntimeInstanceRecordWithMockedFs({
          address: 'http://localhost:7007/',
          instanceId: 'current-instance',
          now: NOW,
          pid: 7007,
          port: 7007,
          storybookVersion: '10.5.0-alpha.0',
        }),
        registryDir
      );

      expect(existsSync(lockedRecordPath)).toBe(true);
      expect(existsSync(currentRecordPath)).toBe(true);
    } finally {
      vi.doUnmock('node:fs/promises');
      vi.resetModules();
    }
  });

  it('does not treat unreadable JSON files as malformed JSON', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const registryDir = makeTempDir();
    const unreadableRecordPath = writeRecordFile({
      instanceId: 'unreadable-instance',
      registryDir,
      updatedAt: daysAgo(8).toISOString(),
    });
    const actualFsPromises =
      await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');

    vi.resetModules();
    vi.doMock('node:fs/promises', () => ({
      ...actualFsPromises,
      readFile: vi.fn(async (path, options) => {
        if (path === unreadableRecordPath) {
          throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
        }

        return actualFsPromises.readFile(path, options);
      }),
    }));

    try {
      const {
        createRuntimeInstanceRecord: createRuntimeInstanceRecordWithMockedFs,
        writeRuntimeInstanceRecord: writeRuntimeInstanceRecordWithMockedFs,
      } = await import('./runtime-instance-registry.ts');
      const currentRecordPath = await writeRuntimeInstanceRecordWithMockedFs(
        createRuntimeInstanceRecordWithMockedFs({
          address: 'http://localhost:7007/',
          instanceId: 'current-instance',
          now: NOW,
          pid: 7007,
          port: 7007,
          storybookVersion: '10.5.0-alpha.0',
        }),
        registryDir
      );

      expect(existsSync(unreadableRecordPath)).toBe(true);
      expect(existsSync(currentRecordPath)).toBe(true);
    } finally {
      vi.doUnmock('node:fs/promises');
      vi.resetModules();
    }
  });
});

describe('writeStorybookRuntimeInstanceRecord', () => {
  it('records Claude preview provenance from the preview launcher environment', async () => {
    vi.stubEnv('CLAUDE_AGENT_SDK_VERSION', '0.1.0');
    vi.stubEnv('AI_AGENT', undefined);

    const registration = await writeStorybookRuntimeInstanceRecord({
      address: 'http://localhost:6006/',
      port: 6006,
      registerCleanup: false,
      registryDir: makeTempDir(),
      storybookVersion: '10.5.0-alpha.0',
    });

    expect(registration.record.agent).toBe('claude-preview');
  });

  it('records the detected agent provenance outside the Claude preview launcher', async () => {
    vi.stubEnv('CLAUDE_AGENT_SDK_VERSION', undefined);
    vi.stubEnv('AI_AGENT', 'codex');

    const registration = await writeStorybookRuntimeInstanceRecord({
      address: 'http://localhost:6006/',
      port: 6006,
      registerCleanup: false,
      registryDir: makeTempDir(),
      storybookVersion: '10.5.0-alpha.0',
    });

    expect(registration.record.agent).toBe('codex');
  });

  it('prefers explicit AI_AGENT provenance over the Claude preview launcher signal', async () => {
    vi.stubEnv('CLAUDE_AGENT_SDK_VERSION', '0.1.0');
    vi.stubEnv('AI_AGENT', 'claude');

    const registration = await writeStorybookRuntimeInstanceRecord({
      address: 'http://localhost:6006/',
      port: 6006,
      registerCleanup: false,
      registryDir: makeTempDir(),
      storybookVersion: '10.5.0-alpha.0',
    });

    expect(registration.record.agent).toBe('claude');
  });

  it('cleans up the written instance record', async () => {
    const registryDir = makeTempDir();
    const registration = await writeStorybookRuntimeInstanceRecord({
      address: 'http://localhost:6006/',
      port: 6006,
      registerCleanup: false,
      registryDir,
      storybookVersion: '10.5.0-alpha.0',
    });

    expect(existsSync(registration.recordPath)).toBe(true);

    await registration.cleanup();

    expect(existsSync(registration.recordPath)).toBe(false);
  });
});
