import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NodeChannelConnection } from '../../../channels/node/index.ts';
import type { StorybookInstanceRecord } from '../instances/types.ts';
import { bootstrapAttachedRuntime } from './attached-runtime.ts';
import {
  AttachUnavailableError,
  EnvironmentMismatchError,
  SpawnFailedError,
  ToolsRuntimeError,
} from './errors.ts';

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
    channel: { id: 'channel' } as NodeChannelConnection['channel'],
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
      cwd: () => '/repo',
      version: '10.2.0',
      resolveBinPath: () => '/repo/node_modules/storybook/package.json',
      ...extras,
    },
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
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
    await expect(failure).rejects.toThrow('cd /apps/web');
    await expect(failure).rejects.toThrow('--config-dir /apps/web/.storybook');
  });

  it('rejects when several instances match and names each --config-dir', async () => {
    const sibling: StorybookInstanceRecord = {
      ...RECORD,
      instanceId: 'sibling',
      pid: 789,
      configDir: '/repo/.storybook-alt',
      url: 'http://localhost:6008',
      port: 6008,
    };
    const { deps } = makeRuntimeDeps([RECORD, sibling]);

    const failure = bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    await expect(failure).rejects.toMatchObject({ data: { reason: 'multiple-matches' } });
    await expect(failure).rejects.toThrow('--config-dir /repo/.storybook');
    await expect(failure).rejects.toThrow('--config-dir /repo/.storybook-alt');
  });

  it('rejects a tokenless record as an old server', async () => {
    const { deps } = makeRuntimeDeps([{ ...RECORD, token: undefined }]);

    const failure = bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    await expect(failure).rejects.toMatchObject({ data: { reason: 'old-server' } });
    await expect(failure).rejects.toThrow('Restart Storybook (v10.2.0+)');
  });

  it('rejects a cwd mismatch before connecting', async () => {
    const { deps } = makeRuntimeDeps([RECORD], { cwd: () => '/elsewhere' });

    const failure = bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    await expect(failure).rejects.toThrow(EnvironmentMismatchError);
    await expect(failure).rejects.toThrow('cd ');
    expect(deps.createNodeChannel).not.toHaveBeenCalled();
  });

  it('rejects a version mismatch before connecting', async () => {
    const { deps } = makeRuntimeDeps([RECORD], { version: '10.1.0' });

    const failure = bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    await expect(failure).rejects.toThrow(EnvironmentMismatchError);
    await expect(failure).rejects.toThrow('10.1.0');
    await expect(failure).rejects.toThrow('10.2.0');
    await expect(failure).rejects.toThrow('Restart your Storybook');
    expect(deps.createNodeChannel).not.toHaveBeenCalled();
  });

  it('returns spawn when autoSpawn is on and the project package matches the instance', async () => {
    const { deps } = makeRuntimeDeps([RECORD], {
      cwd: () => '/elsewhere',
      resolveProjectVersion: () => '10.2.0',
    });

    const result = await bootstrapAttachedRuntime({ cwd: '/repo', autoSpawn: true }, deps);

    expect(result).toEqual({ kind: 'spawn', record: RECORD });
    expect(deps.createNodeChannel).not.toHaveBeenCalled();
  });

  it('throws restart guidance when autoSpawn cannot help because the project package also differs', async () => {
    const { deps } = makeRuntimeDeps([RECORD], {
      version: '10.3.0',
      resolveProjectVersion: () => '10.4.0',
    });

    const failure = bootstrapAttachedRuntime({ cwd: '/repo', autoSpawn: true }, deps);

    await expect(failure).rejects.toThrow(EnvironmentMismatchError);
    await expect(failure).rejects.toThrow('10.4.0');
    await expect(failure).rejects.toThrow('10.2.0');
    await expect(failure).rejects.toThrow('Restart your Storybook');
    expect(deps.createNodeChannel).not.toHaveBeenCalled();
  });

  it('throws SpawnFailedError when autoSpawn is on but storybook cannot be resolved under the instance', async () => {
    const { deps } = makeRuntimeDeps([RECORD], {
      cwd: () => '/elsewhere',
      resolveProjectVersion: () => undefined,
    });

    const failure = bootstrapAttachedRuntime({ cwd: '/repo', autoSpawn: true }, deps);

    await expect(failure).rejects.toThrow(SpawnFailedError);
    await expect(failure).rejects.toThrow(RECORD.cwd);
    expect(deps.createNodeChannel).not.toHaveBeenCalled();
  });

  it('throws a mismatch rather than spawning when this process is already a child host', async () => {
    const { deps } = makeRuntimeDeps([RECORD], {
      cwd: () => '/elsewhere',
      isChildHost: true,
      resolveProjectVersion: () => '10.2.0',
    });

    const failure = bootstrapAttachedRuntime({ cwd: '/repo', autoSpawn: true }, deps);

    await expect(failure).rejects.toThrow(EnvironmentMismatchError);
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
  });

  it('wraps a configuration that cannot be loaded', async () => {
    const { deps } = makeRuntimeDeps([RECORD], {
      loadStorybook: vi.fn(async () => {
        throw new Error('No configuration files found');
      }),
    });

    const failure = bootstrapAttachedRuntime({ cwd: '/repo' }, deps);

    await expect(failure).rejects.toThrow(ToolsRuntimeError);
    await expect(failure).rejects.toMatchObject({ data: { reason: 'config-load-failed' } });
  });
});
