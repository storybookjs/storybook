import { Channel } from '@storybook/core/internal/channels';
import { defineToolset } from '@storybook/core/open-service';
import * as v from 'valibot';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TOOLSET_CALL_ACK,
  TOOLSET_CALL_CANCEL,
  TOOLSET_CALL_ERROR,
  TOOLSET_CALL_INVOKE,
  TOOLSET_CALL_RESULT,
  TOOLSET_DESCRIBE,
  TOOLSET_DESCRIBE_ERROR,
  TOOLSET_DESCRIBE_RESULT,
  TOOLSET_TELEMETRY,
  TOOLSET_TELEMETRY_ACK,
} from '@storybook/core/internal/deep/shared/open-service/toolset-rpc';
import { telemetry } from '@storybook/core/internal/telemetry';

import { serveToolsetRpc } from './toolset-rpc-host.ts';

vi.mock('@storybook/core/internal/telemetry', { spy: true });

/** The `ctx.signal` each `docs.slow` call received, in call order. */
const slowSignals: AbortSignal[] = [];

beforeEach(() => {
  vi.mocked(telemetry).mockReset();
  vi.mocked(telemetry).mockResolvedValue(undefined);
  slowSignals.length = 0;
});

const CLIENT = { name: 'storybook-cli', version: '11.0.0', transport: 'cli' } as const;

const DOCS = defineToolset({
  id: 'docs',
  description: 'Docs tools',
  methods: {
    list: {
      title: 'List docs',
      description: (ctx) => `List docs (${ctx.transport})`,
      input: v.strictObject({ limit: v.optional(v.number()) }),
      handler: async (input, ctx) => ({
        ok: true,
        data: { limit: input.limit ?? null, origin: ctx.origin ?? null, transport: ctx.transport },
        markdown: 'listed',
        telemetry: { payload: { count: 1 } },
      }),
    },
    show: {
      title: 'Show doc',
      description: 'Show one doc',
      input: v.strictObject({ id: v.string() }),
      handler: async (input) => ({ ok: false, data: { id: input.id }, markdown: 'not found' }),
    },
    broken: {
      title: 'Broken',
      description: 'Always throws',
      input: v.strictObject({}),
      handler: async () => {
        throw new Error('handler exploded');
      },
    },
    slow: {
      title: 'Slow',
      description: 'Never settles',
      input: v.strictObject({}),
      handler: (_, ctx) => {
        slowSignals.push(ctx.signal);
        return new Promise<never>(() => {});
      },
    },
  },
});

const REPLY_EVENTS = [
  TOOLSET_DESCRIBE_RESULT,
  TOOLSET_DESCRIBE_ERROR,
  TOOLSET_CALL_ACK,
  TOOLSET_CALL_RESULT,
  TOOLSET_CALL_ERROR,
  TOOLSET_TELEMETRY_ACK,
];

/** A host on a transportless channel, with every reply it emits recorded in order. */
function setup() {
  const channel = new Channel({});
  const replies: Array<{ type: string; payload: Record<string, unknown> }> = [];
  for (const type of REPLY_EVENTS) {
    channel.on(type, (payload: Record<string, unknown>) => replies.push({ type, payload }));
  }
  const dispose = serveToolsetRpc({
    channel,
    toolsets: () => [DOCS],
    getService: vi.fn(),
    origin: 'http://localhost:6006',
    configDir: '/repo/.storybook',
  });
  const settled = (callId: string) =>
    vi.waitFor(() => {
      const reply = replies.find(
        (entry) => entry.payload.callId === callId && entry.type !== TOOLSET_CALL_ACK
      );
      if (!reply) {
        throw new Error('no reply yet');
      }
      return reply;
    });
  return { channel, replies, dispose, settled };
}

/** The serialized error fields a client rebuilds the error from. */
function errorFields(payload: Record<string, unknown>) {
  const error = payload.error as { name: string; message: string; properties?: { data?: unknown } };
  return { name: error.name, message: error.message, data: error.properties?.data };
}

describe('serveToolsetRpc describe', () => {
  it('returns the catalog resolved for the client transport', async () => {
    const { channel, settled } = setup();

    channel.emit(TOOLSET_DESCRIBE, { callId: 'd1', clientInfo: CLIENT, toolset: 'docs' });

    const reply = await settled('d1');
    expect(reply.type).toBe(TOOLSET_DESCRIBE_RESULT);
    const catalog = reply.payload.catalog as {
      configDir: string;
      toolsets: Array<{ id: string; methods: Array<{ ref: string; description: string }> }>;
    };
    expect({
      configDir: catalog.configDir,
      methods: catalog.toolsets.flatMap((toolset) =>
        toolset.methods.map((method) => `${method.ref}: ${method.description}`)
      ),
    }).toMatchInlineSnapshot(`
      {
        "configDir": "/repo/.storybook",
        "methods": [
          "docs.list: List docs (cli)",
          "docs.show: Show one doc",
          "docs.broken: Always throws",
          "docs.slow: Never settles",
        ],
      }
    `);
  });

  it('reports an unknown toolset as a describe error', async () => {
    const { channel, settled } = setup();

    channel.emit(TOOLSET_DESCRIBE, { callId: 'd2', clientInfo: CLIENT, toolset: 'nope' });

    const reply = await settled('d2');
    expect(reply.type).toBe(TOOLSET_DESCRIBE_ERROR);
    expect(errorFields(reply.payload)).toMatchInlineSnapshot(`
      {
        "data": {
          "message": "Unknown toolset \`nope\`. The Storybook configuration at /repo/.storybook provides: docs.",
          "reason": "unknown-toolset",
        },
        "message": "Unknown toolset \`nope\`. The Storybook configuration at /repo/.storybook provides: docs.",
        "name": "SB_CLI_0007 (ToolsRuntimeError)",
      }
    `);
  });
});

describe('serveToolsetRpc call', () => {
  it.each([
    {
      name: 'ok outcome with the host origin and the report',
      invoke: { methodId: 'docs.list', input: { limit: 2 } },
      expected: {
        type: TOOLSET_CALL_RESULT,
        outcome: {
          ok: true,
          data: { limit: 2, origin: 'http://localhost:6006', transport: 'cli' },
          markdown: 'listed',
          telemetry: {
            payload: { count: 1 },
            toolset: 'docs',
            tool: 'list',
            event: 'tool:docs_list',
          },
        },
      },
    },
    {
      name: 'origin override',
      invoke: { methodId: 'docs.list', input: {}, origin: 'http://127.0.0.1:6006/sb' },
      expected: {
        type: TOOLSET_CALL_RESULT,
        outcome: expect.objectContaining({
          data: { limit: null, origin: 'http://127.0.0.1:6006/sb', transport: 'cli' },
        }),
      },
    },
    {
      name: 'ok: false outcome',
      invoke: { methodId: 'docs.show', input: { id: 'button' } },
      expected: {
        type: TOOLSET_CALL_RESULT,
        outcome: { ok: false, data: { id: 'button' }, markdown: 'not found' },
      },
    },
  ])('$name', async ({ invoke, expected }) => {
    const { channel, replies, settled } = setup();

    channel.emit(TOOLSET_CALL_INVOKE, { callId: 'c1', clientInfo: CLIENT, ...invoke });

    const reply = await settled('c1');
    expect(replies[0]).toEqual({ type: TOOLSET_CALL_ACK, payload: { callId: 'c1' } });
    expect({ type: reply.type, outcome: reply.payload.outcome }).toEqual(expected);
  });

  it.each([
    {
      name: 'unknown method',
      invoke: { methodId: 'docs.nope', input: {} },
      expected: {
        name: 'SB_CLI_0007 (ToolsRuntimeError)',
        reason: 'unknown-method',
        message: 'Unknown tool `docs.nope`. The `docs` toolset provides: list, show, broken, slow.',
      },
    },
    {
      name: 'unknown toolset',
      invoke: { methodId: 'nope.list', input: {} },
      expected: {
        name: 'SB_CLI_0007 (ToolsRuntimeError)',
        reason: 'unknown-toolset',
        message:
          'Unknown toolset `nope`. The Storybook configuration at /repo/.storybook provides: docs.',
      },
    },
    {
      name: 'malformed reference',
      invoke: { methodId: 'docs', input: {} },
      expected: {
        name: 'SB_CLI_0007 (ToolsRuntimeError)',
        reason: 'unknown-method',
        message: 'Invalid tool reference `docs`. Expected `toolsetId.methodName`.',
      },
    },
    {
      name: 'invalid input',
      invoke: { methodId: 'docs.show', input: { id: 1, extra: true } },
      expected: {
        name: 'SB_CLI_0007 (ToolsRuntimeError)',
        reason: 'invalid-input',
        message: expect.stringContaining('Invalid input for `docs.show`'),
      },
    },
    {
      name: 'handler throw',
      invoke: { methodId: 'docs.broken', input: {} },
      expected: { name: 'Error', reason: undefined, message: 'handler exploded' },
    },
  ])('$name replies with a call error', async ({ invoke, expected }) => {
    const { channel, settled } = setup();

    channel.emit(TOOLSET_CALL_INVOKE, { callId: 'c2', clientInfo: CLIENT, ...invoke });

    const reply = await settled('c2');
    const fields = errorFields(reply.payload);
    expect(reply.type).toBe(TOOLSET_CALL_ERROR);
    expect({
      name: fields.name,
      reason: (fields.data as { reason?: string } | undefined)?.reason,
      message: fields.message,
    }).toEqual(expected);
  });

  it('carries JSON-safe issue paths for invalid input', async () => {
    const { channel, settled } = setup();

    channel.emit(TOOLSET_CALL_INVOKE, {
      callId: 'c3',
      clientInfo: CLIENT,
      methodId: 'docs.show',
      input: { id: 1 },
    });

    const reply = await settled('c3');
    expect((errorFields(reply.payload).data as { issues: unknown }).issues).toMatchInlineSnapshot(`
      [
        {
          "message": "Invalid type: Expected string but received 1",
          "path": [
            {
              "key": "id",
            },
          ],
        },
      ]
    `);
  });

  it('aborts a running call on cancel', async () => {
    const { channel, settled } = setup();

    channel.emit(TOOLSET_CALL_INVOKE, {
      callId: 'c4',
      clientInfo: CLIENT,
      methodId: 'docs.slow',
      input: {},
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    channel.emit(TOOLSET_CALL_CANCEL, { callId: 'c4' });

    const reply = await settled('c4');
    expect(reply.type).toBe(TOOLSET_CALL_ERROR);
    expect(errorFields(reply.payload).name).toBe('AbortError');
  });

  it.each([
    { name: 'a cancel for that call', stop: 'cancel', expected: [true] },
    { name: 'host teardown', stop: 'dispose', expected: [true] },
    { name: 'a cancel for another call', stop: 'cancel-other', expected: [false] },
  ] as const)('aborts the handler signal on $name', async ({ stop, expected }) => {
    const { channel, dispose } = setup();

    channel.emit(TOOLSET_CALL_INVOKE, {
      callId: 'c7',
      clientInfo: CLIENT,
      methodId: 'docs.slow',
      input: {},
    });
    await vi.waitFor(() => expect(slowSignals).toHaveLength(1));
    if (stop === 'dispose') {
      dispose();
    } else {
      channel.emit(TOOLSET_CALL_CANCEL, { callId: stop === 'cancel' ? 'c7' : 'other' });
    }

    expect(slowSignals.map((signal) => signal.aborted)).toEqual(expected);
  });

  it('ignores malformed invokes and fires no telemetry', async () => {
    const { channel, replies, settled } = setup();

    channel.emit(TOOLSET_CALL_INVOKE, { callId: 'bad', methodId: 'docs.list' });
    channel.emit(TOOLSET_CALL_INVOKE, {
      callId: 'c5',
      clientInfo: CLIENT,
      methodId: 'docs.list',
      input: {},
    });

    await settled('c5');
    expect(replies.some((entry) => entry.payload.callId === 'bad')).toBe(false);
    expect(telemetry).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'a client record',
      payload: { callId: 't1', payload: { client: 'cli', success: true, toolset: 'docs' } },
      expected: {
        acks: [{ callId: 't1' }],
        sent: [
          [
            'tools-command',
            { client: 'cli', success: true, toolset: 'docs' },
            { configDir: '/repo/.storybook' },
          ],
        ],
      },
    },
    {
      name: 'a malformed record',
      payload: { callId: 't2', payload: 'nope' },
      expected: { acks: [], sent: [] },
    },
  ])('sends $name as the one tools-command event', async ({ payload, expected }) => {
    const { channel, replies } = setup();

    channel.emit(TOOLSET_TELEMETRY, payload);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect({
      acks: replies
        .filter((entry) => entry.type === TOOLSET_TELEMETRY_ACK)
        .map((entry) => entry.payload),
      sent: vi.mocked(telemetry).mock.calls,
    }).toEqual(expected);
  });

  it('stops answering after dispose', async () => {
    const { channel, replies, dispose } = setup();

    dispose();
    channel.emit(TOOLSET_DESCRIBE, { callId: 'd3', clientInfo: CLIENT });
    channel.emit(TOOLSET_CALL_INVOKE, {
      callId: 'c6',
      clientInfo: CLIENT,
      methodId: 'docs.list',
      input: {},
    });
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(replies).toEqual([]);
  });
});
