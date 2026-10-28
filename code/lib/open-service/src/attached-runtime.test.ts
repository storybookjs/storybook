import { fileURLToPath } from 'node:url';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { inspect } from 'node:util';

import { vol } from 'memfs';
import { join } from 'pathe';
import { getChannel } from '@storybook/core/internal/channels';
import {
  createStorybook as createInstance,
  type CreateStorybookInput,
  type Storybook,
} from '@storybook/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NodeChannelConnection } from './node-channel.ts';
import type { StorybookInstanceRecord } from './instances/types.ts';
import { bootstrapAttachedRuntime } from './attached-runtime.ts';
import { AttachUnavailableError, EnvironmentMismatchError, ToolsRuntimeError } from './errors.ts';

vi.mock('node:fs', { spy: true });

const STORYBOOK_PATH = '/repo/node_modules/storybook';
const CORE_PATH = '/repo/node_modules/@storybook/core';
const FOREIGN_STORYBOOK_PATH = '/npx-cache/node_modules/storybook';
const FOREIGN_CORE_PATH = '/npx-cache/node_modules/@storybook/core';
const PRE_SPLIT_STORYBOOK_PATH = '/old/node_modules/storybook';

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
  corePath: CORE_PATH,
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
    transport: { send: vi.fn(), setHandler: vi.fn() },
    connected: Promise.resolve(),
    disconnected: new Promise<never>(() => {}),
    close: vi.fn(),
  };
}

function makeRuntimeDeps(records: StorybookInstanceRecord[], extras: Record<string, unknown> = {}) {
  const connection = makeConnection();
  const storybook = {
    attached: true,
    configDir: records[0]?.configDir,
    toolsets: { values: vi.fn(() => []) },
    services: { get: vi.fn() },
    close: vi.fn(async () => {}),
  } as unknown as Storybook;
  const createStorybook = vi.fn(async (input: CreateStorybookInput) => ({
    ...storybook,
    configDir: input.configDir,
  }));
  return {
    connection,
    deps: {
      readRegistry: async () => records,
      createNodeChannel: vi.fn(async () => connection),
      createStorybook,
      version: '10.2.0',
      corePath: () => CORE_PATH,
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
    '/repo/.storybook/main.js': '',
    [`${STORYBOOK_PATH}/package.json`]: '{"name":"storybook"}',
    [`${FOREIGN_STORYBOOK_PATH}/package.json`]: '{"name":"storybook"}',
    [`${PRE_SPLIT_STORYBOOK_PATH}/package.json`]: '{"name":"storybook"}',
    [`${CORE_PATH}/package.json`]: '{"name":"@storybook/core"}',
    [`${FOREIGN_CORE_PATH}/package.json`]: '{"name":"@storybook/core"}',
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
  it('connects and creates an attached headless instance', async () => {
    const { connection, deps } = makeRuntimeDeps([RECORD]);

    const result = await bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    expect(deps.createNodeChannel).toHaveBeenCalledWith({
      url: RECORD.url,
      token: RECORD.token,
    });
    expect(deps.createStorybook).toHaveBeenCalledWith({
      configDir: RECORD.configDir,
      workingDir: RECORD.cwd,
      mode: 'headless',
      attach: { transport: connection.transport },
    });
    expect(result.kind).toBe('in-process');
    expect(result.record).toEqual(RECORD);
    if (result.kind === 'in-process') {
      expect(result.runtime.configDir).toBe(RECORD.configDir);
      expect(result.runtime.storybook.attached).toBe(true);
      await result.runtime.close();
      expect(result.runtime.storybook.close).toHaveBeenCalledOnce();
      expect(connection.close).toHaveBeenCalledOnce();
    }
  });

  it.each([
    { name: 'same installation', corePath: CORE_PATH },
    { name: 'another installation', corePath: FOREIGN_CORE_PATH },
  ])('connects over the toolset RPC without creating an instance ($name)', async ({ corePath }) => {
    const { connection, deps } = makeRuntimeDeps([{ ...RECORD, toolsetRpc: 1 }], {
      corePath: () => corePath,
    });

    const result = await bootstrapAttachedRuntime({ cwd: '/repo', autoSpawn: true }, deps);

    expect(result.kind).toBe('remote');
    expect(result).toMatchObject({ connection, siblings: [] });
    expect(deps.createStorybook).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'no capability', toolsetRpc: undefined },
    { name: 'a newer protocol', toolsetRpc: 2 },
  ])('attaches the older way for $name', async ({ toolsetRpc }) => {
    const { deps } = makeRuntimeDeps([{ ...RECORD, toolsetRpc }]);

    const result = await bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    expect(result.kind).toBe('in-process');
    expect(deps.createStorybook).toHaveBeenCalledOnce();
  });

  it('reports a failed RPC connection as connection-failed', async () => {
    const { deps } = makeRuntimeDeps([{ ...RECORD, toolsetRpc: 1 }], {
      createNodeChannel: vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    });

    const error = await rejectedAttachUnavailable(bootstrapAttachedRuntime({ cwd: '/repo' }, deps));

    expect(error.data.reason).toBe('connection-failed');
  });

  it('keeps the global channel unchanged while an attached instance is open and after close', async () => {
    const previousChannel = getChannel();
    const configDir = fileURLToPath(
      new URL('../../../core/src/instance/__fixtures__/first', import.meta.url)
    );
    const { deps } = makeRuntimeDeps([{ ...RECORD, configDir }], {
      createStorybook: (input: CreateStorybookInput) =>
        createInstance({ ...input, main: { stories: [] } }, { builtInAddons: [] }),
    });
    const result = await bootstrapAttachedRuntime({ cwd: '/repo', configDir }, deps);
    expect(getChannel()).toBe(previousChannel);
    if (result.kind !== 'in-process') {
      throw new Error('Expected an in-process runtime');
    }
    expect(result.runtime.storybook.attached).toBe(true);
    await result.runtime.close();
    expect(getChannel()).toBe(previousChannel);
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

  it.each([
    {
      name: 'the same core joins in-process',
      record: RECORD,
      autoSpawn: true,
      expected: { kind: 'in-process' },
    },
    {
      name: 'a different core spawns from the recorded storybook',
      record: { ...RECORD, storybookPath: FOREIGN_STORYBOOK_PATH, corePath: FOREIGN_CORE_PATH },
      autoSpawn: true,
      expected: { kind: 'spawn', storybookPath: FOREIGN_STORYBOOK_PATH },
    },
    {
      name: 'a pre-split storybook without a core spawns from the recorded storybook',
      record: { ...RECORD, storybookPath: PRE_SPLIT_STORYBOOK_PATH, corePath: undefined },
      autoSpawn: true,
      expected: { kind: 'spawn', storybookPath: PRE_SPLIT_STORYBOOK_PATH },
    },
    {
      name: 'a record without storybookPath is refused',
      record: { ...RECORD, storybookPath: undefined, corePath: undefined },
      autoSpawn: true,
      expected: {
        error:
          "Could not identify the running Storybook's installation, so this CLI cannot attach to it. Restart that Storybook, then retry.",
      },
    },
    {
      name: 'a different core is refused when auto-spawn is declined',
      record: { ...RECORD, storybookPath: FOREIGN_STORYBOOK_PATH, corePath: FOREIGN_CORE_PATH },
      autoSpawn: false,
      expected: {
        error: [
          'The running Storybook and this CLI are different `@storybook/core` installations:',
          '- running instance: `/npx-cache/node_modules/@storybook/core` (version 10.2.0; config dir `/repo/.storybook`)',
          '- this CLI: `/repo/node_modules/@storybook/core` (version 10.2.0)',
          'Attaching across installations needs a child host from the running Storybook; omit `autoSpawn: false` to allow it.',
        ].join('\n'),
      },
    },
    {
      name: 'a pre-split storybook is refused when auto-spawn is declined',
      record: { ...RECORD, storybookPath: PRE_SPLIT_STORYBOOK_PATH, corePath: undefined },
      autoSpawn: false,
      expected: {
        error: [
          'The running Storybook and this CLI are different `@storybook/core` installations:',
          '- running instance: no `@storybook/core` (older `storybook`) (version 10.2.0; config dir `/repo/.storybook`)',
          '- this CLI: `/repo/node_modules/@storybook/core` (version 10.2.0)',
          'Attaching across installations needs a child host from the running Storybook; omit `autoSpawn: false` to allow it.',
        ].join('\n'),
      },
    },
  ])('installation gate: $name', async ({ record, autoSpawn, expected }) => {
    const { deps } = makeRuntimeDeps([record], {
      hasChildHost: (storybookPath: string) => storybookPath === PRE_SPLIT_STORYBOOK_PATH,
    });

    const outcome = await bootstrapAttachedRuntime({ cwd: '/repo', autoSpawn }, deps).then(
      (result) =>
        result.kind === 'spawn'
          ? { kind: result.kind, storybookPath: result.storybookPath }
          : { kind: result.kind },
      (error: unknown) => {
        expect(error).toBeInstanceOf(EnvironmentMismatchError);
        return { error: (error as EnvironmentMismatchError).data.reason };
      }
    );

    expect(outcome).toEqual(expected);
  });

  it('spawns from a pre-split storybook through its legacy child host entry', async () => {
    vi.mocked(realpathSync).mockRestore();
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'open-service-pre-split-')));
    try {
      const storybookPath = join(root, 'node_modules/storybook');
      mkdirSync(storybookPath, { recursive: true });
      writeFileSync(
        join(storybookPath, 'package.json'),
        JSON.stringify({
          name: 'storybook',
          exports: { './internal/tools/child-host': './child-host.js' },
        })
      );
      writeFileSync(join(storybookPath, 'child-host.js'), '');
      const record = { ...RECORD, storybookPath, corePath: undefined };
      const { deps } = makeRuntimeDeps([record]);

      const result = await bootstrapAttachedRuntime({ cwd: '/repo', autoSpawn: true }, deps);

      expect(result).toEqual({ kind: 'spawn', record, storybookPath, siblings: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses rather than spawning when this process is already a child host', async () => {
    const foreign: StorybookInstanceRecord = {
      ...RECORD,
      storybookPath: FOREIGN_STORYBOOK_PATH,
      corePath: FOREIGN_CORE_PATH,
    };
    const { deps } = makeRuntimeDeps([foreign], { isChildHost: true });

    const failure = bootstrapAttachedRuntime({ cwd: '/repo', autoSpawn: true }, deps);

    await expect(failure).rejects.toThrow(EnvironmentMismatchError);
    expect(deps.createNodeChannel).not.toHaveBeenCalled();
  });

  it('refuses a recorded installation that no longer exists on disk, even when auto-spawn is on', async () => {
    const { deps } = makeRuntimeDeps([
      {
        ...RECORD,
        storybookPath: '/gone/node_modules/storybook',
        corePath: '/gone/node_modules/@storybook/core',
      },
    ]);

    const failure = bootstrapAttachedRuntime({ cwd: '/repo', autoSpawn: true }, deps);

    await expect(failure).rejects.toThrow(EnvironmentMismatchError);
    await expect(failure).rejects.toThrow('Could not identify');
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
        transport: { send: vi.fn(), setHandler: vi.fn() },
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
      createStorybook: vi.fn(async () => {
        throw new Error('No configuration files found');
      }),
    });

    const failure = bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    await expect(failure).rejects.toThrow(ToolsRuntimeError);
    await expect(failure).rejects.toMatchObject({ data: { reason: 'config-load-failed' } });
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
