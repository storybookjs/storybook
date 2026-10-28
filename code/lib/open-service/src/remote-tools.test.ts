import type { ChannelEvent, ChannelHandler } from '@storybook/core/internal/channels';
import { StorybookDevServerDisconnectedError } from '@storybook/core/internal/server-errors';
import { telemetry } from '@storybook/core/internal/telemetry';
import { serializeError } from '@storybook/core/internal/deep/shared/open-service/service-error-serialization';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToolsRuntimeError } from './errors.ts';
import type { StorybookInstanceRecord } from './instances/types.ts';
import { createRemoteTools } from './remote-tools.ts';

vi.mock('@storybook/core/internal/telemetry', { spy: true });

const RECORD: StorybookInstanceRecord = {
  schemaVersion: 1,
  instanceId: 'abc',
  pid: 123,
  cwd: '/repo',
  configDir: '/repo/.storybook',
  url: 'http://localhost:6006',
  port: 6006,
  token: 'secret',
  storybookVersion: '11.0.0',
  toolsetRpc: 1,
  mcp: { status: 'not-installed' },
};

const CATALOG = { configDir: '/repo/.storybook', toolsets: [] };

type Reply = { type: string; payload: Record<string, unknown> };

/**
 * A fake dev server behind the client's transport: `respond` maps each request the client sends to
 * the replies the server emits back, and `sent` records every request. Telemetry records are acked
 * unless `ackTelemetry` is false.
 */
function setup(
  respond: (event: { type: string; payload: Record<string, unknown> }) => Reply[],
  { ackTelemetry = true }: { ackTelemetry?: boolean } = {}
) {
  let handler: ChannelHandler | undefined;
  const sent: Array<{ type: string; payload: Record<string, unknown> }> = [];
  let disconnect!: (error: Error) => void;
  const disconnected = new Promise<never>((_, reject) => {
    disconnect = reject;
  });
  void disconnected.catch(() => {});
  const connection = {
    transport: {
      setHandler: (next: ChannelHandler) => {
        handler = next;
      },
      send: (event: ChannelEvent) => {
        const request = { type: event.type, payload: event.args[0] as Record<string, unknown> };
        sent.push(request);
        const replies =
          request.type === 'toolsets:telemetry'
            ? ackTelemetry
              ? [{ type: 'toolsets:telemetry-ack', payload: { callId: request.payload.callId } }]
              : []
            : respond(request);
        for (const reply of replies) {
          queueMicrotask(() =>
            handler?.({ type: reply.type, from: 'server', args: [reply.payload] })
          );
        }
      },
    },
    disconnected,
    close: vi.fn(),
  };
  const tools = createRemoteTools(
    {
      record: RECORD,
      siblings: [],
      connection,
      clientInfo: { name: 'test-sdk', version: '11.0.0', kind: 'sdk' },
      requestedMode: 'attached',
    },
    { ackTimeoutMs: 20, describeTimeoutMs: 20, telemetryTimeoutMs: 20 }
  );
  return { tools, sent, connection, disconnect };
}

const ok = (callId: unknown, outcome: Record<string, unknown>): Reply[] => [
  { type: 'toolsets:call-ack', payload: { callId } },
  { type: 'toolsets:call-result', payload: { callId, outcome } },
];

beforeEach(() => {
  vi.mocked(telemetry).mockReset();
  vi.mocked(telemetry).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createRemoteTools', () => {
  it('identifies the attached Storybook from its record and loads nothing', () => {
    const { tools } = setup(() => []);

    expect({ mode: tools.mode, host: tools.host, storybook: tools.storybook })
      .toMatchInlineSnapshot(`
      {
        "host": "remote",
        "mode": "attached",
        "storybook": {
          "attached": true,
          "configDir": "/repo/.storybook",
          "cwd": "/repo",
          "pid": 123,
          "port": 6006,
          "url": "http://localhost:6006",
          "version": "11.0.0",
        },
      }
    `);
    expect(tools.runtime.toolsets).toEqual([]);
  });

  it('describes over the RPC with the client transport', async () => {
    const { tools, sent } = setup(({ type, payload }) =>
      type === 'toolsets:describe'
        ? [
            {
              type: 'toolsets:describe-result',
              payload: { callId: payload.callId, catalog: CATALOG },
            },
          ]
        : []
    );

    await expect(tools.describe({ toolset: 'docs' })).resolves.toEqual(CATALOG);
    expect(sent.map(({ type, payload }) => ({ type, ...payload, callId: '<id>' }))).toEqual([
      {
        type: 'toolsets:describe',
        callId: '<id>',
        clientInfo: { name: 'test-sdk', version: '11.0.0', transport: 'sdk' },
        toolset: 'docs',
      },
    ]);
  });

  it('calls over the RPC and hands its one tools-command record to the host', async () => {
    const outcome = {
      ok: true,
      data: { count: 1 },
      markdown: 'listed',
      telemetry: { payload: { count: 1 }, toolset: 'docs', tool: 'list', event: 'tool:docs_list' },
    };
    const { tools, sent } = setup(({ type, payload }) =>
      type === 'toolsets:call-invoke' ? ok(payload.callId, outcome) : []
    );

    await expect(
      tools.call('docs.list', { limit: 1 }, { origin: 'http://127.0.0.1:6006' })
    ).resolves.toEqual(outcome);
    expect(sent[0]).toMatchObject({
      type: 'toolsets:call-invoke',
      payload: { methodId: 'docs.list', input: { limit: 1 }, origin: 'http://127.0.0.1:6006' },
    });
    expect(telemetry).not.toHaveBeenCalled();
    expect(sent.filter(({ type }) => type === 'toolsets:telemetry')).toMatchObject([
      {
        payload: {
          payload: {
            event: 'tool:docs_list',
            count: 1,
            host: 'remote',
            resolvedMode: 'attached',
            success: true,
          },
        },
      },
    ]);
  });

  it('returns the outcome when the host never confirms the telemetry record', async () => {
    const outcome = { ok: true, data: {}, markdown: 'listed' };
    const { tools, sent } = setup(
      ({ type, payload }) => (type === 'toolsets:call-invoke' ? ok(payload.callId, outcome) : []),
      { ackTelemetry: false }
    );

    await expect(tools.call('docs.list', {})).resolves.toEqual(outcome);
    expect(sent.map(({ type }) => type)).toEqual(['toolsets:call-invoke', 'toolsets:telemetry']);
    expect(telemetry).not.toHaveBeenCalled();
  });

  it('returns an ok: false outcome without throwing', async () => {
    const outcome = { ok: false, data: {}, markdown: 'not found' };
    const { tools } = setup(({ type, payload }) =>
      type === 'toolsets:call-invoke' ? ok(payload.callId, outcome) : []
    );

    await expect(tools.call('docs.show', { id: 'x' })).resolves.toEqual(outcome);
  });

  it.each([
    {
      name: 'invalid input',
      error: new ToolsRuntimeError({
        reason: 'invalid-input',
        message: 'Invalid input for `docs.show`',
        issues: [{ message: 'Expected string', path: [{ key: 'id' }] }],
      }),
      expected: {
        reason: 'invalid-input',
        issues: [{ message: 'Expected string', path: [{ key: 'id' }] }],
      },
    },
    {
      name: 'unknown method',
      error: new ToolsRuntimeError({ reason: 'unknown-method', message: 'Unknown tool' }),
      expected: { reason: 'unknown-method' },
    },
  ])('rebuilds a host $name error as ToolsRuntimeError', async ({ error, expected }) => {
    const { tools, sent } = setup(({ type, payload }) =>
      type === 'toolsets:call-invoke'
        ? [
            { type: 'toolsets:call-ack', payload: { callId: payload.callId } },
            {
              type: 'toolsets:call-error',
              payload: {
                callId: payload.callId,
                error: JSON.parse(JSON.stringify(serializeError(error))),
              },
            },
          ]
        : []
    );

    const failure = await tools.call('docs.show', {}).catch((caught: unknown) => caught);

    expect(failure).toBeInstanceOf(ToolsRuntimeError);
    expect((failure as ToolsRuntimeError).data).toMatchObject(expected);
    expect(sent.find(({ type }) => type === 'toolsets:telemetry')?.payload).toMatchObject({
      payload: { outcome: 'error', host: 'remote' },
    });
  });

  it('keeps a plain host error as a plain error', async () => {
    const { tools } = setup(({ type, payload }) =>
      type === 'toolsets:call-invoke'
        ? [
            {
              type: 'toolsets:call-error',
              payload: { callId: payload.callId, error: serializeError(new Error('exploded')) },
            },
          ]
        : []
    );

    await expect(tools.call('docs.broken', {})).rejects.toThrow('exploded');
  });

  it.each([
    {
      name: 'call',
      run: (tools: ReturnType<typeof setup>['tools']) => tools.call('docs.list', {}),
    },
    { name: 'describe', run: (tools: ReturnType<typeof setup>['tools']) => tools.describe() },
  ])('rejects a $name the host never answers', async ({ run }) => {
    const { tools } = setup(() => []);

    const failure = await run(tools).catch((caught: unknown) => caught);

    expect(failure).toBeInstanceOf(ToolsRuntimeError);
    expect((failure as ToolsRuntimeError).data.reason).toBe('command-unhandled');
  });

  it('waits past the ack window once the host acknowledged', async () => {
    const { tools } = setup(({ type, payload }) =>
      type === 'toolsets:call-invoke'
        ? [{ type: 'toolsets:call-ack', payload: { callId: payload.callId } }]
        : []
    );
    const pending = tools.call('docs.slow', {});
    let settled = false;
    void pending.then(
      () => (settled = true),
      () => (settled = true)
    );

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(settled).toBe(false);
  });

  it('cancels on the host when the signal aborts', async () => {
    const { tools, sent } = setup(({ type, payload }) =>
      type === 'toolsets:call-invoke'
        ? [{ type: 'toolsets:call-ack', payload: { callId: payload.callId } }]
        : []
    );
    const controller = new AbortController();

    const pending = tools.call('docs.slow', {}, { signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 5));
    controller.abort(new Error('stop'));

    await expect(pending).rejects.toThrow('stop');
    expect(sent.map((entry) => entry.type)).toEqual([
      'toolsets:call-invoke',
      'toolsets:call-cancel',
      'toolsets:telemetry',
    ]);
    expect(sent[1].payload.callId).toBe(sent[0].payload.callId);
  });

  it('rejects in-flight calls as connection-lost when the server goes away', async () => {
    const { tools, disconnect } = setup(({ type, payload }) =>
      type === 'toolsets:call-invoke'
        ? [{ type: 'toolsets:call-ack', payload: { callId: payload.callId } }]
        : []
    );

    const pending = tools.call('docs.slow', {});
    disconnect(new StorybookDevServerDisconnectedError({ code: 1006 }));

    const failure = await pending.catch((caught: unknown) => caught);
    expect((failure as ToolsRuntimeError).data.reason).toBe('connection-lost');
  });

  it('closes the connection once and serves nothing after', async () => {
    const { tools, connection } = setup(() => []);

    await tools.close();
    await tools.close();

    expect(connection.close).toHaveBeenCalledTimes(1);
    await expect(tools.call('docs.list', {})).rejects.toMatchObject({ data: { reason: 'closed' } });
    await expect(tools.describe()).rejects.toMatchObject({ data: { reason: 'closed' } });
  });
});
