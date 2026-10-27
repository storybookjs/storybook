import { realpathSync } from 'node:fs';
import { inspect } from 'node:util';

import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NodeChannelConnection } from './node-channel.ts';
import type { StorybookInstanceRecord } from '../instances/types.ts';
import { bootstrapAttachedRuntime } from './attached-runtime.ts';
import { AttachUnavailableError, EnvironmentMismatchError, ToolsRuntimeError } from './errors.ts';

vi.mock('node:fs', { spy: true });

const STORYBOOK_PATH = '/repo/node_modules/storybook';
const FOREIGN_STORYBOOK_PATH = '/npx-cache/node_modules/storybook';

const RECORD: StorybookInstanceRecord = {
  schemaVersion: 1,
  instanceId: 'abc',
  pid: 123,
  cwd: '/repo',
  configDir: '/repo/.storybook',
  url: 'http://localhost:6006',
  port: 6006,
  token: 'secret',
  storybookVersion: '10.2.0',
  storybookPath: STORYBOOK_PATH,
  mcp: { status: 'ready' },
};

const OTHER: StorybookInstanceRecord = {
  ...RECORD,
  instanceId: 'other',
  pid: 456,
  cwd: '/apps/web',
  configDir: '/apps/web/.storybook',
  url: 'http://localhost:6007',
  port: 6007,
};

function makeConnection(): NodeChannelConnection {
  return {
    channel: { id: 'channel' } as unknown as NodeChannelConnection['channel'],
    connected: Promise.resolve(),
    disconnected: new Promise<never>(() => {}),
    close: vi.fn(),
  };
}

function makeRuntimeDeps(records: StorybookInstanceRecord[], extras: Record<string, unknown> = {}) {
  const connection = makeConnection();
  const loadStorybook = vi.fn(async () => ({}));
  const getService = vi.fn(() => {
    throw new Error('no services in this test');
  });
  const setDelegatedMode = vi.fn();
  const getRegisteredToolsets = vi.fn(() => []);
  return {
    connection,
    deps: {
      readRegistry: async () => records,
      createNodeChannel: vi.fn(async () => connection),
      loadStorybook,
      getService,
      setDelegatedMode,
      getRegisteredToolsets,
      version: '10.2.0',
      storybookPath: () => STORYBOOK_PATH,
      ...extras,
    },
  };
}

async function rejectedAttachUnavailable(
  failure: Promise<unknown>
): Promise<AttachUnavailableError> {
  try {
    await failure;
  } catch (caught) {
    expect(caught).toBeInstanceOf(AttachUnavailableError);
    if (caught instanceof AttachUnavailableError) {
      return caught;
    }
  }
  throw new Error('expected AttachUnavailableError');
}

beforeEach(async () => {
  vi.unstubAllGlobals();
  vol.reset();
  vol.fromNestedJSON({
    [`${STORYBOOK_PATH}/package.json`]: '{"name":"storybook"}',
    [`${FOREIGN_STORYBOOK_PATH}/package.json`]: '{"name":"storybook"}',
  });
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(realpathSync).mockImplementation(
    memfs.fs.realpathSync as unknown as typeof import('node:fs').realpathSync
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('bootstrapAttachedRuntime', () => {
  it('connects, enables delegated mode, then loads the instance configuration', async () => {
    const { connection, deps } = makeRuntimeDeps([RECORD]);

    const result = await bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    expect(deps.createNodeChannel).toHaveBeenCalledWith({
      url: RECORD.url,
      token: RECORD.token,
    });
    expect(deps.setDelegatedMode).toHaveBeenCalledWith(true);
    expect(deps.loadStorybook).toHaveBeenCalledWith({
      configDir: RECORD.configDir,
      channel: connection.channel,
    });
    expect(deps.setDelegatedMode.mock.invocationCallOrder[0]).toBeLessThan(
      deps.loadStorybook.mock.invocationCallOrder[0]
    );
    expect(result.kind).toBe('in-process');
    expect(result.record).toEqual(RECORD);
    if (result.kind === 'in-process') {
      expect(result.runtime.configDir).toBe(RECORD.configDir);
    }
  });

  it('does not change process.cwd()', async () => {
    const cwdBefore = process.cwd();
    const { deps } = makeRuntimeDeps([RECORD]);

    await bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    expect(process.cwd()).toBe(cwdBefore);
  });

  it('rejects when no instance matches and lists the others', async () => {
    const { deps } = makeRuntimeDeps([OTHER]);

    const failure = bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    await expect(failure).rejects.toThrow(AttachUnavailableError);
    await expect(failure).rejects.toMatchObject({ data: { reason: 'no-instance' } });
    await expect(failure).rejects.toThrow('npm run storybook');
    await expect(failure).rejects.toThrow('configDir `/apps/web/.storybook`');
    const error = await rejectedAttachUnavailable(failure);
    expect(error.data.instances.every((instance) => !('token' in instance))).toBe(true);
    expect(inspect(error)).not.toContain('secret');
  });

  it('attaches to the most recently started instance when several match, reporting the siblings', async () => {
    const older: StorybookInstanceRecord = {
      ...RECORD,
      instanceId: 'older',
      pid: 789,
      url: 'http://localhost:6008',
      port: 6008,
      startedAt: '2026-08-27T10:00:00.000Z',
    };
    const newest: StorybookInstanceRecord = {
      ...RECORD,
      startedAt: '2026-08-27T11:00:00.000Z',
    };
    const { deps } = makeRuntimeDeps([older, newest]);

    const result = await bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    expect(result.record).toEqual(newest);
    expect(result.siblings).toEqual([older]);
    expect(deps.createNodeChannel).toHaveBeenCalledWith({
      url: newest.url,
      token: newest.token,
    });
  });

  it('reports no siblings when exactly one instance matches', async () => {
    const { deps } = makeRuntimeDeps([RECORD, OTHER]);

    const result = await bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    expect(result.siblings).toEqual([]);
  });

  it('prefers the invoking agent bucket over recency when several match', async () => {
    const mine: StorybookInstanceRecord = {
      ...RECORD,
      agent: 'codex',
      startedAt: '2026-08-27T10:00:00.000Z',
    };
    const newerForeign: StorybookInstanceRecord = {
      ...RECORD,
      instanceId: 'foreign',
      pid: 789,
      url: 'http://localhost:6008',
      port: 6008,
      agent: 'cursor',
      startedAt: '2026-08-27T11:00:00.000Z',
    };
    const { deps } = makeRuntimeDeps([mine, newerForeign], {
      detectAgentName: () => 'codex',
    });

    const result = await bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    expect(result.record).toEqual(mine);
    expect(result.siblings).toEqual([]);
  });

  it('attaches to the instance on the requested port even when a sibling is newer', async () => {
    const onPort: StorybookInstanceRecord = {
      ...RECORD,
      startedAt: '2026-08-27T10:00:00.000Z',
    };
    const newer: StorybookInstanceRecord = {
      ...RECORD,
      instanceId: 'newer',
      pid: 789,
      url: 'http://localhost:6008',
      port: 6008,
      startedAt: '2026-08-27T11:00:00.000Z',
    };
    const { deps } = makeRuntimeDeps([onPort, newer]);

    const result = await bootstrapAttachedRuntime({ cwd: '/repo', port: 6006 }, deps);

    expect(result.record).toEqual(onPort);
    expect(result.siblings).toEqual([]);
  });

  it('attaches by port alone from an unrelated cwd, inferring the project from the record', async () => {
    const { deps } = makeRuntimeDeps([RECORD]);

    const result = await bootstrapAttachedRuntime({ cwd: '/somewhere/else', port: 6006 }, deps);

    expect(result.record).toEqual(RECORD);
    expect(result.siblings).toEqual([]);
  });

  it('rejects with port-mismatch listing the running ports when no matching instance is on the port', async () => {
    const sibling: StorybookInstanceRecord = {
      ...RECORD,
      instanceId: 'sibling',
      pid: 789,
      url: 'http://localhost:6008',
      port: 6008,
    };
    const { deps } = makeRuntimeDeps([RECORD, sibling]);

    const failure = bootstrapAttachedRuntime({ cwd: '/repo', port: 9999 }, deps);

    await expect(failure).rejects.toThrow(AttachUnavailableError);
    await expect(failure).rejects.toMatchObject({ data: { reason: 'port-mismatch' } });
    await expect(failure).rejects.toThrow('9999');
    await expect(failure).rejects.toThrow('http://localhost:6006');
    await expect(failure).rejects.toThrow('http://localhost:6008');
    await expect(failure).rejects.toThrow('--port');
    const error = await rejectedAttachUnavailable(failure);
    expect(error.data.instances.every((instance) => !('token' in instance))).toBe(true);
    expect(inspect(error)).not.toContain('secret');
  });

  it('picks the most recent instance even when only an older sibling could attach (not token-aware)', async () => {
    const olderWithToken: StorybookInstanceRecord = {
      ...RECORD,
      instanceId: 'older',
      pid: 789,
      url: 'http://localhost:6008',
      port: 6008,
      startedAt: '2026-08-27T10:00:00.000Z',
    };
    const newestTokenless: StorybookInstanceRecord = {
      ...RECORD,
      token: undefined,
      startedAt: '2026-08-27T11:00:00.000Z',
    };
    const { deps } = makeRuntimeDeps([olderWithToken, newestTokenless]);

    const failure = bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    await expect(failure).rejects.toMatchObject({ data: { reason: 'old-server' } });
  });

  it('rejects a tokenless record as an old server', async () => {
    const { deps } = makeRuntimeDeps([{ ...RECORD, token: undefined }]);

    const failure = bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    await expect(failure).rejects.toMatchObject({ data: { reason: 'old-server' } });
    await expect(failure).rejects.toThrow('Restart Storybook (v10.2.0+)');
  });

  it('attaches from the project when the instance was started from an unrelated directory', async () => {
    const startedElsewhere: StorybookInstanceRecord = { ...RECORD, cwd: '/scratch/empty' };
    const { deps } = makeRuntimeDeps([startedElsewhere]);

    const result = await bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    expect(result.kind).toBe('in-process');
    expect(result.record).toEqual(startedElsewhere);
  });

  it('returns spawn when autoSpawn is on and the instance runs a different installation', async () => {
    const foreign: StorybookInstanceRecord = { ...RECORD, storybookPath: FOREIGN_STORYBOOK_PATH };
    const { deps } = makeRuntimeDeps([foreign]);

    const result = await bootstrapAttachedRuntime({ cwd: '/repo', autoSpawn: true }, deps);

    expect(result).toEqual({
      kind: 'spawn',
      record: foreign,
      storybookPath: FOREIGN_STORYBOOK_PATH,
      siblings: [],
    });
    expect(deps.createNodeChannel).not.toHaveBeenCalled();
  });

  it('refuses a different installation when auto-spawn is declined, naming both installations', async () => {
    const foreign: StorybookInstanceRecord = { ...RECORD, storybookPath: FOREIGN_STORYBOOK_PATH };
    const { deps } = makeRuntimeDeps([foreign]);

    const failure = bootstrapAttachedRuntime({ cwd: '/repo', autoSpawn: false }, deps);

    await expect(failure).rejects.toThrow(EnvironmentMismatchError);
    await expect(failure).rejects.toThrow('different `storybook` installations');
    await expect(failure).rejects.toThrow(FOREIGN_STORYBOOK_PATH);
    await expect(failure).rejects.toThrow(STORYBOOK_PATH);
    await expect(failure).rejects.toThrow('10.2.0');
    await expect(failure).rejects.toThrow(RECORD.configDir!);
    expect(deps.createNodeChannel).not.toHaveBeenCalled();
  });

  it('refuses rather than spawning when this process is already a child host', async () => {
    const foreign: StorybookInstanceRecord = { ...RECORD, storybookPath: FOREIGN_STORYBOOK_PATH };
    const { deps } = makeRuntimeDeps([foreign], { isChildHost: true });

    const failure = bootstrapAttachedRuntime({ cwd: '/repo', autoSpawn: true }, deps);

    await expect(failure).rejects.toThrow(EnvironmentMismatchError);
    expect(deps.createNodeChannel).not.toHaveBeenCalled();
  });

  it('refuses a record that does not name its installation, even when auto-spawn is on', async () => {
    const { deps } = makeRuntimeDeps([{ ...RECORD, storybookPath: undefined }]);

    const failure = bootstrapAttachedRuntime({ cwd: '/repo', autoSpawn: true }, deps);

    await expect(failure).rejects.toThrow(EnvironmentMismatchError);
    await expect(failure).rejects.toThrow('Could not verify');
    await expect(failure).rejects.toThrow('restart Storybook');
    expect(deps.createNodeChannel).not.toHaveBeenCalled();
  });

  it('refuses a recorded installation that no longer exists on disk, even when auto-spawn is on', async () => {
    const { deps } = makeRuntimeDeps([
      { ...RECORD, storybookPath: '/gone/node_modules/storybook' },
    ]);

    const failure = bootstrapAttachedRuntime({ cwd: '/repo', autoSpawn: true }, deps);

    await expect(failure).rejects.toThrow(EnvironmentMismatchError);
    await expect(failure).rejects.toThrow('Could not verify');
    expect(deps.createNodeChannel).not.toHaveBeenCalled();
  });

  it('rejects a channel that never opens', async () => {
    const { deps } = makeRuntimeDeps([RECORD], {
      createNodeChannel: vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    });

    const failure = bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    await expect(failure).rejects.toMatchObject({ data: { reason: 'connection-failed' } });
    await expect(failure).rejects.toThrow(RECORD.url);
    await expect(failure).rejects.toThrow('npm run storybook');
    const error = await rejectedAttachUnavailable(failure);
    expect(error.data.instances.every((instance) => !('token' in instance))).toBe(true);
    expect(inspect(error)).not.toContain('secret');
  });

  it('rejects when the handshake never completes', async () => {
    vi.useFakeTimers();
    const close = vi.fn();
    const { deps } = makeRuntimeDeps([RECORD], {
      createNodeChannel: vi.fn(async () => ({
        channel: { id: 'channel' } as unknown as NodeChannelConnection['channel'],
        connected: new Promise<void>(() => {}),
        disconnected: new Promise<never>(() => {}),
        close,
      })),
    });

    const failure = bootstrapAttachedRuntime({ cwd: '/repo' }, deps);
    const assertion = expect(failure).rejects.toMatchObject({
      data: { reason: 'connection-failed' },
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(close).toHaveBeenCalled();
  });

  it('wraps a configuration that cannot be loaded', async () => {
    const { connection, deps } = makeRuntimeDeps([RECORD], {
      loadStorybook: vi.fn(async () => {
        throw new Error('No configuration files found');
      }),
    });

    const failure = bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    await expect(failure).rejects.toThrow(ToolsRuntimeError);
    await expect(failure).rejects.toMatchObject({ data: { reason: 'config-load-failed' } });
    expect(deps.setDelegatedMode).toHaveBeenLastCalledWith(false);
    expect(connection.close).toHaveBeenCalled();
  });

  it('matches a nested package cwd against a parent-cwd record whose configDir is the package Storybook', async () => {
    const nested: StorybookInstanceRecord = {
      ...RECORD,
      cwd: '/repo',
      configDir: '/repo/packages/ui/.storybook',
    };
    const { deps } = makeRuntimeDeps([nested], { cwd: () => '/repo' });

    const result = await bootstrapAttachedRuntime({ cwd: '/repo/packages/ui' }, deps);

    expect(result.kind).toBe('in-process');
    expect(result.record).toEqual(nested);
    if (result.kind === 'in-process') {
      expect(result.runtime.configDir).toBe(nested.configDir);
    }
  });
});
