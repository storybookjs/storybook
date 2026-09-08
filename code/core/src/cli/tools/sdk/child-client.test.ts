import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { telemetry } from 'storybook/internal/telemetry';

import { serializeError } from '../../../shared/open-service/service-error-serialization.ts';
import { spawnChildHost } from './child-client.ts';
import { CHILD_HOST_PROTOCOL_VERSION } from './child-protocol.ts';
import { SpawnFailedError, ToolsRuntimeError, AttachUnavailableError } from './errors.ts';
import type { StorybookInstanceRecord } from '../instances/types.ts';
import type { CreateToolsOptions, ToolsClientInfo, ToolsMode } from './types.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });

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

const OPTIONS: CreateToolsOptions = { mode: 'attached', configDir: '/repo/.storybook' };
const LOCAL_OPTIONS: CreateToolsOptions = { mode: 'local', configDir: '/repo/.storybook' };
const CLIENT: Required<ToolsClientInfo> = {
  name: 'storybook-tools-sdk',
  version: '10.3.0',
  kind: 'sdk',
};

const HELLO = {
  type: 'hello' as const,
  version: CHILD_HOST_PROTOCOL_VERSION,
  storybook: {
    version: '10.2.0',
    configDir: '/repo/.storybook',
    url: 'http://localhost:6006',
    pid: 123,
  },
  clientInfo: CLIENT,
};

function createFakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    send: ReturnType<typeof vi.fn>;
    kill: ReturnType<typeof vi.fn>;
    connected: boolean;
    pid: number;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.send = vi.fn();
  child.kill = vi.fn();
  child.connected = true;
  child.pid = 4242;
  return child;
}

describe('spawnChildHost', () => {
  const log = vi.fn();
  const warn = vi.fn();
  let child: ReturnType<typeof createFakeChild>;
  let fork: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    log.mockReset();
    warn.mockReset();
    child = createFakeChild();
    fork = vi.fn(() => child);
    vi.mocked(telemetry).mockReset();
    vi.mocked(telemetry).mockResolvedValue(undefined);
    child.send.mockImplementation((message: { type: string; id?: string }) => {
      if (message.type === 'init') {
        queueMicrotask(() => child.emit('message', HELLO));
      }
      if (message.type === 'describe') {
        queueMicrotask(() =>
          child.emit('message', {
            type: 'result',
            id: message.id,
            value: { configDir: RECORD.configDir, toolsets: [{ id: 'docs', methods: [] }] },
          })
        );
      }
      if (message.type === 'call') {
        queueMicrotask(() =>
          child.emit('message', {
            type: 'result',
            id: message.id,
            value: { ok: true, data: { ran: true }, markdown: 'ok' },
          })
        );
      }
      return true;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const spawn = (
    options: CreateToolsOptions = OPTIONS,
    requestedMode: ToolsMode = options.mode === 'auto'
      ? 'auto'
      : options.mode === 'local'
        ? 'local'
        : 'attached'
  ) =>
    spawnChildHost(
      { cwd: RECORD.cwd, options, clientInfo: CLIENT, requestedMode },
      {
        fork: fork as never,
        resolveScript: () => '/repo/node_modules/storybook/dist/cli/tools/sdk/child-host.js',
        logger: { log, warn },
      }
    );

  it('names the recorded installation and restart guidance when it cannot resolve the child host', async () => {
    const failure = spawnChildHost(
      {
        cwd: RECORD.cwd,
        installationPath: '/npx-cache/node_modules/storybook',
        options: OPTIONS,
        clientInfo: CLIENT,
        requestedMode: 'attached',
      },
      {
        fork: fork as never,
        resolveScript: () => {
          throw Object.assign(new Error('MODULE_NOT_FOUND'), { code: 'MODULE_NOT_FOUND' });
        },
        logger: { log, warn },
      }
    );

    await expect(failure).rejects.toThrow(SpawnFailedError);
    await expect(failure).rejects.toThrow('/npx-cache/node_modules/storybook');
    await expect(failure).rejects.toThrow('restart Storybook');
    expect(fork).not.toHaveBeenCalled();
  });

  it('resolves the child host from the installation path when one is given, keeping the cwd', async () => {
    const resolveScript = vi.fn(
      () => '/npx-cache/node_modules/storybook/dist/cli/tools/sdk/child-host.js'
    );

    await spawnChildHost(
      {
        cwd: RECORD.cwd,
        installationPath: '/npx-cache/node_modules/storybook',
        options: OPTIONS,
        clientInfo: CLIENT,
        requestedMode: 'attached',
      },
      { fork: fork as never, resolveScript, logger: { log, warn } }
    );

    expect(resolveScript).toHaveBeenCalledWith('/npx-cache/node_modules/storybook');
    expect(fork).toHaveBeenCalledWith(
      '/npx-cache/node_modules/storybook/dist/cli/tools/sdk/child-host.js',
      [],
      expect.objectContaining({ cwd: RECORD.cwd })
    );
  });

  it('forks the project-local child host with cwd, piped stdio, ipc, and loop-guard env', async () => {
    await spawn();

    expect(fork).toHaveBeenCalledWith(
      '/repo/node_modules/storybook/dist/cli/tools/sdk/child-host.js',
      [],
      expect.objectContaining({
        cwd: '/repo',
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        env: expect.objectContaining({
          STORYBOOK_TOOLS_CHILD_HOST: 'true',
          STORYBOOK_ATTACHED_TOOLS: 'true',
        }),
      })
    );
    expect(child.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'init',
        options: expect.objectContaining({
          cwd: '/repo',
          mode: 'attached',
          autoSpawn: false,
          clientInfo: CLIENT,
        }),
      })
    );
  });

  it('forks a local child host without STORYBOOK_ATTACHED_TOOLS', async () => {
    const tools = await spawn(LOCAL_OPTIONS);

    expect(fork).toHaveBeenCalledWith(
      '/repo/node_modules/storybook/dist/cli/tools/sdk/child-host.js',
      [],
      expect.objectContaining({
        cwd: '/repo',
        env: expect.not.objectContaining({
          STORYBOOK_ATTACHED_TOOLS: 'true',
        }),
      })
    );
    expect(child.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'init',
        options: expect.objectContaining({
          cwd: '/repo',
          mode: 'local',
          autoSpawn: false,
          clientInfo: CLIENT,
        }),
      })
    );
    expect(tools.mode).toBe('local');
    expect(tools.host).toBe('child');
  });

  it('proxies describe and call over IPC and returns the child storybook info', async () => {
    const tools = await spawn();

    expect(tools.mode).toBe('attached');
    expect(tools.host).toBe('child');
    expect(tools.requestedMode).toBe('attached');
    expect(tools.storybook).toEqual(HELLO.storybook);
    await expect(tools.describe()).resolves.toEqual({
      configDir: RECORD.configDir,
      toolsets: [{ id: 'docs', methods: [] }],
    });
    await expect(tools.call('docs.list', { id: 'button' })).resolves.toEqual({
      ok: true,
      data: { ran: true },
      markdown: 'ok',
    });
    expect(child.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'describe', options: {} })
    );
    expect(child.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'call',
        ref: 'docs.list',
        input: { id: 'button' },
      })
    );
  });

  it('forwards child method telemetry to the call sink without resolving the waiter', async () => {
    child.send.mockImplementation((message: { type: string; id?: string }) => {
      if (message.type === 'init') {
        queueMicrotask(() => child.emit('message', HELLO));
      }
      if (message.type === 'call') {
        queueMicrotask(() => {
          child.emit('message', {
            type: 'telemetry',
            id: message.id,
            event: 'tool:listAllDocumentation',
            payload: { toolset: 'docs' },
          });
          child.emit('message', {
            type: 'result',
            id: message.id,
            value: { ok: true, data: { ran: true }, markdown: 'ok' },
          });
        });
      }
      return true;
    });
    const sink = vi.fn(async () => {});
    const tools = await spawn(OPTIONS, 'auto');

    await expect(tools.call('docs.list', {}, { telemetry: sink })).resolves.toEqual({
      ok: true,
      data: { ran: true },
      markdown: 'ok',
    });
    expect(tools.requestedMode).toBe('auto');
    expect(sink).toHaveBeenCalledWith(
      'tool:listAllDocumentation',
      expect.objectContaining({
        toolset: 'docs',
        client: 'sdk',
        requestedMode: 'auto',
        resolvedMode: 'attached',
        attachMode: 'attached',
        host: 'child',
      })
    );
    expect(telemetry).toHaveBeenCalledWith(
      'tools-command',
      expect.objectContaining({
        command: 'docs list',
        success: true,
        outcome: 'success',
        client: 'sdk',
        requestedMode: 'auto',
        host: 'child',
      }),
      expect.anything()
    );
  });

  it('does not reject the call when a forwarded telemetry sink fails', async () => {
    child.send.mockImplementation((message: { type: string; id?: string }) => {
      if (message.type === 'init') {
        queueMicrotask(() => child.emit('message', HELLO));
      }
      if (message.type === 'call') {
        queueMicrotask(() => {
          child.emit('message', {
            type: 'telemetry',
            id: message.id,
            event: 'tool:listAllDocumentation',
            payload: { toolset: 'docs' },
          });
          child.emit('message', {
            type: 'result',
            id: message.id,
            value: { ok: true, data: { ran: true }, markdown: 'ok' },
          });
        });
      }
      return true;
    });
    const sink = vi.fn(async () => {
      throw new Error('telemetry down');
    });
    const tools = await spawn();

    await expect(tools.call('docs.list', {}, { telemetry: sink })).resolves.toEqual({
      ok: true,
      data: { ran: true },
      markdown: 'ok',
    });
  });

  it('does not reject the call when a forwarded telemetry sink throws synchronously', async () => {
    child.send.mockImplementation((message: { type: string; id?: string }) => {
      if (message.type === 'init') {
        queueMicrotask(() => child.emit('message', HELLO));
      }
      if (message.type === 'call') {
        queueMicrotask(() => {
          child.emit('message', {
            type: 'telemetry',
            id: message.id,
            event: 'tool:listAllDocumentation',
            payload: { toolset: 'docs' },
          });
          child.emit('message', {
            type: 'result',
            id: message.id,
            value: { ok: true, data: { ran: true }, markdown: 'ok' },
          });
        });
      }
      return true;
    });
    const sink = vi.fn(() => {
      throw new Error('telemetry down');
    });
    const tools = await spawn();

    await expect(tools.call('docs.list', {}, { telemetry: sink })).resolves.toEqual({
      ok: true,
      data: { ran: true },
      markdown: 'ok',
    });
    expect(sink).toHaveBeenCalledWith(
      'tool:listAllDocumentation',
      expect.objectContaining({
        toolset: 'docs',
        client: 'sdk',
        requestedMode: 'attached',
        resolvedMode: 'attached',
        attachMode: 'attached',
        host: 'child',
      })
    );
  });

  it('sends a cancel envelope keyed by the call id when the signal aborts', async () => {
    child.send.mockImplementation((message: { type: string; id?: string }) => {
      if (message.type === 'init') {
        queueMicrotask(() => child.emit('message', HELLO));
      }
      return true;
    });
    const tools = await spawn();
    const controller = new AbortController();

    const pending = tools.call('docs.list', {}, { signal: controller.signal });
    await vi.waitFor(() => {
      expect(child.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'call' }));
    });
    const callMessage = child.send.mock.calls.find(([message]) => message.type === 'call')?.[0] as {
      id: string;
    };
    controller.abort();

    expect(child.send).toHaveBeenCalledWith({ type: 'cancel', id: callMessage.id });
    child.emit('message', {
      type: 'error',
      id: callMessage.id,
      error: serializeError(controller.signal.reason ?? new Error('aborted')),
    });
    await expect(pending).rejects.toThrow();
  });

  it('rejects the caller when the signal aborts even if the child never replies', async () => {
    child.send.mockImplementation((message: { type: string; id?: string }) => {
      if (message.type === 'init') {
        queueMicrotask(() => child.emit('message', HELLO));
      }
      return true;
    });
    const tools = await spawn();
    const controller = new AbortController();

    const pending = tools.call('docs.list', {}, { signal: controller.signal });
    await vi.waitFor(() => {
      expect(child.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'call' }));
    });
    controller.abort('stopped');

    await expect(pending).rejects.toBe('stopped');
    expect(child.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'cancel' }));
  });

  it('rejects in-flight requests when the proxy is closed', async () => {
    child.send.mockImplementation((message: { type: string; id?: string }) => {
      if (message.type === 'init') {
        queueMicrotask(() => child.emit('message', HELLO));
      }
      return true;
    });
    const tools = await spawn();
    const pending = tools.call('docs.list');
    await vi.waitFor(() => {
      expect(child.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'call' }));
    });

    await tools.close();

    await expect(pending).rejects.toMatchObject({ data: { reason: 'closed' } });
    expect(child.kill).toHaveBeenCalled();
  });

  it('kills the child when the proxy is closed', async () => {
    const tools = await spawn();

    await tools.close();

    expect(child.send).toHaveBeenCalledWith({ type: 'close' });
    expect(child.kill).toHaveBeenCalled();
    await expect(tools.describe()).rejects.toMatchObject({ data: { reason: 'closed' } });
  });

  it('re-emits child stdout and stderr through the node logger', async () => {
    await spawn();

    child.stdout.emit('data', Buffer.from('from-child-out'));
    child.stderr.emit('data', Buffer.from('from-child-err'));

    expect(log).toHaveBeenCalledWith('from-child-out');
    expect(warn).toHaveBeenCalledWith('from-child-err');
  });

  it('throws SpawnFailedError when the child-host script cannot be resolved', async () => {
    const failure = spawnChildHost(
      { cwd: RECORD.cwd, options: OPTIONS, clientInfo: CLIENT, requestedMode: 'attached' },
      {
        fork: fork as never,
        resolveScript: () => {
          throw Object.assign(new Error('MODULE_NOT_FOUND'), { code: 'MODULE_NOT_FOUND' });
        },
      }
    );

    await expect(failure).rejects.toThrow(SpawnFailedError);
    await expect(failure).rejects.toThrow('storybook/internal/tools/child-host');
    expect(fork).not.toHaveBeenCalled();
  });

  it('throws SpawnFailedError when the child exits before hello', async () => {
    child.send.mockImplementation((message: { type: string }) => {
      if (message.type === 'init') {
        queueMicrotask(() => child.emit('exit', 1, null));
      }
      return true;
    });

    const failure = spawn();

    await expect(failure).rejects.toThrow(SpawnFailedError);
    await expect(failure).rejects.toThrow('exited before it was ready');
    expect(child.kill).toHaveBeenCalled();
  });

  it('throws SpawnFailedError when the child speaks a different protocol version', async () => {
    child.send.mockImplementation((message: { type: string }) => {
      if (message.type === 'init') {
        queueMicrotask(() => child.emit('message', { ...HELLO, version: 99 }));
      }
      return true;
    });

    const failure = spawn();

    await expect(failure).rejects.toThrow(SpawnFailedError);
    await expect(failure).rejects.toThrow('protocol 99');
    expect(child.kill).toHaveBeenCalled();
  });

  it('rethrows a serialized error from the child on call', async () => {
    const tools = await spawn();
    child.send.mockImplementation((message: { type: string; id?: string }) => {
      if (message.type === 'call') {
        queueMicrotask(() =>
          child.emit('message', {
            type: 'error',
            id: message.id,
            error: serializeError(
              new ToolsRuntimeError({
                reason: 'unknown-toolset',
                message: 'Unknown toolset `nope`.',
              })
            ),
          })
        );
      }
      return true;
    });

    await expect(tools.call('nope.list')).rejects.toBeInstanceOf(ToolsRuntimeError);
    await expect(tools.call('nope.list')).rejects.toThrow('Unknown toolset `nope`.');
  });

  it('rehydrates a serialized AttachUnavailableError from child init so instanceof matches', async () => {
    child.send.mockImplementation((message: { type: string }) => {
      if (message.type === 'init') {
        queueMicrotask(() =>
          child.emit('message', {
            type: 'error',
            id: 'init',
            error: serializeError(
              new AttachUnavailableError({
                reason: 'no-instance',
                instances: [],
                remediation: 'No running Storybook was found for this project.',
              })
            ),
          })
        );
      }
      return true;
    });

    const failure = spawn();

    await expect(failure).rejects.toBeInstanceOf(AttachUnavailableError);
    await expect(failure).rejects.toThrow('No running Storybook was found');
    expect(child.kill).toHaveBeenCalled();
  });

  it('throws SpawnFailedError when the child never says hello', async () => {
    vi.useFakeTimers();
    child.send.mockImplementation(() => true);

    const pending = spawn();
    const assertion = expect(pending).rejects.toThrow(/did not become ready in time/);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(child.kill).toHaveBeenCalled();
  });
});
