import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
  fromToolsetRpcError,
  toToolsetRpcError,
  toolsetCallAckSchema,
  toolsetCallCancelSchema,
  toolsetCallErrorSchema,
  toolsetCallInvokeSchema,
  toolsetCallResultSchema,
  toolsetDescribeErrorSchema,
  toolsetDescribeResultSchema,
  toolsetDescribeSchema,
  toolsetTelemetryAckSchema,
  toolsetTelemetrySchema,
} from './toolset-rpc.ts';

const CLIENT = { name: 'storybook-tools-cli', version: '11.0.0', transport: 'cli' };

/** A payload as the other side receives it: through JSON, like the WebSocket channel. */
function overTheWire(payload: unknown): unknown {
  return JSON.parse(JSON.stringify(payload));
}

describe('toolset RPC payloads', () => {
  it.each([
    {
      name: 'describe',
      schema: toolsetDescribeSchema,
      input: { callId: 'c1', clientInfo: CLIENT },
      valid: true,
    },
    {
      name: 'describe one toolset',
      schema: toolsetDescribeSchema,
      input: { callId: 'c1', clientInfo: CLIENT, toolset: 'docs' },
      valid: true,
    },
    {
      name: 'describe with an unknown transport',
      schema: toolsetDescribeSchema,
      input: { callId: 'c1', clientInfo: { ...CLIENT, transport: 'http' } },
      valid: false,
    },
    {
      name: 'describe result',
      schema: toolsetDescribeResultSchema,
      input: { callId: 'c1', catalog: { configDir: '/repo/.storybook', toolsets: [] } },
      valid: true,
    },
    {
      name: 'describe result without toolsets',
      schema: toolsetDescribeResultSchema,
      input: { callId: 'c1', catalog: { configDir: '/repo/.storybook' } },
      valid: false,
    },
    {
      name: 'describe error',
      schema: toolsetDescribeErrorSchema,
      input: toToolsetRpcError('c1', new Error('boom')),
      valid: true,
    },
    {
      name: 'call invoke',
      schema: toolsetCallInvokeSchema,
      input: { callId: 'c2', methodId: 'docs.list', input: {}, clientInfo: CLIENT },
      valid: true,
    },
    {
      name: 'call invoke without input',
      schema: toolsetCallInvokeSchema,
      input: { callId: 'c2', methodId: 'docs.list', clientInfo: CLIENT },
      valid: true,
    },
    {
      name: 'call invoke with an origin override',
      schema: toolsetCallInvokeSchema,
      input: {
        callId: 'c2',
        methodId: 'stories.preview',
        input: { id: 'button--primary' },
        clientInfo: CLIENT,
        origin: 'http://localhost:6006/sb',
      },
      valid: true,
    },
    {
      name: 'call invoke with array input',
      schema: toolsetCallInvokeSchema,
      input: { callId: 'c2', methodId: 'docs.list', input: [], clientInfo: CLIENT },
      valid: false,
    },
    {
      name: 'call ack',
      schema: toolsetCallAckSchema,
      input: { callId: 'c2' },
      valid: true,
    },
    {
      name: 'call result',
      schema: toolsetCallResultSchema,
      input: {
        callId: 'c2',
        outcome: {
          ok: true,
          data: { count: 1 },
          markdown: ['a', 'b'],
          images: [{ path: '/tmp/shot.png', mimeType: 'image/png' }],
        },
      },
      valid: true,
    },
    {
      name: 'call result with ok: false',
      schema: toolsetCallResultSchema,
      input: { callId: 'c2', outcome: { ok: false, data: {}, markdown: 'not found' } },
      valid: true,
    },
    {
      name: 'call result without ok',
      schema: toolsetCallResultSchema,
      input: { callId: 'c2', outcome: { data: {} } },
      valid: false,
    },
    {
      name: 'call error',
      schema: toolsetCallErrorSchema,
      input: toToolsetRpcError('c2', new TypeError('bad')),
      valid: true,
    },
    {
      name: 'call error with a string error',
      schema: toolsetCallErrorSchema,
      input: { callId: 'c2', error: 'bad' },
      valid: false,
    },
    {
      name: 'call cancel',
      schema: toolsetCallCancelSchema,
      input: { callId: 'c2' },
      valid: true,
    },
    {
      name: 'call cancel without callId',
      schema: toolsetCallCancelSchema,
      input: {},
      valid: false,
    },
    {
      name: 'telemetry record',
      schema: toolsetTelemetrySchema,
      input: { callId: 't1', payload: { client: 'cli', success: true, duration: 12 } },
      valid: true,
    },
    {
      name: 'telemetry record without payload',
      schema: toolsetTelemetrySchema,
      input: { callId: 't1' },
      valid: false,
    },
    {
      name: 'telemetry ack',
      schema: toolsetTelemetryAckSchema,
      input: { callId: 't1' },
      valid: true,
    },
  ])('$name parses after JSON: $valid', ({ schema, input, valid }) => {
    const parsed = v.safeParse(schema as v.GenericSchema, overTheWire(input));

    expect(parsed.success).toBe(valid);
    if (valid) {
      expect(parsed.output).toEqual(overTheWire(input));
    }
  });
});

describe('toolset RPC errors', () => {
  it.each([
    {
      name: 'plain error',
      input: new Error('boom'),
      expected: { name: 'Error', message: 'boom' },
    },
    {
      name: 'error with data',
      input: Object.assign(new Error('Unknown tool `docs.nope`.'), {
        name: 'ToolsRuntimeError',
        data: { reason: 'unknown-method', message: 'Unknown tool `docs.nope`.' },
      }),
      expected: {
        name: 'ToolsRuntimeError',
        message: 'Unknown tool `docs.nope`.',
        data: { reason: 'unknown-method', message: 'Unknown tool `docs.nope`.' },
      },
    },
    {
      name: 'abort',
      input: new DOMException('This operation was aborted', 'AbortError'),
      expected: { name: 'AbortError', message: 'This operation was aborted' },
    },
    {
      name: 'non-error throw',
      input: 'nope',
      expected: { name: 'Error', message: 'nope' },
    },
  ])('$name round-trips through JSON', ({ input, expected }) => {
    const payload = v.parse(toolsetCallErrorSchema, overTheWire(toToolsetRpcError('c3', input)));
    const error = fromToolsetRpcError(payload);

    expect(payload.callId).toBe('c3');
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject(expected);
  });

  it('keeps the cause chain', () => {
    const error = fromToolsetRpcError(
      overTheWire(
        toToolsetRpcError('c4', new Error('outer', { cause: new Error('inner') }))
      ) as ReturnType<typeof toToolsetRpcError>
    );

    expect((error.cause as Error).message).toBe('inner');
  });
});
