import { describe, expect, it } from 'vitest';

import type { StandardSchemaV1 } from '@standard-schema/spec';
import * as v from 'valibot';

import { defineToolset, invokeToolsetMethod } from './toolset-definition.ts';

const toolsetWithInput = (input: StandardSchemaV1) =>
  defineToolset({
    id: 'probe',
    description: 'Probe toolset.',
    methods: {
      run: {
        title: 'Run',
        description: 'Runs.',
        input,
        handler: () => ({ ok: true, data: undefined, markdown: '' }) as const,
      },
    },
  });

describe('defineToolset', () => {
  it.each([
    ['v.object', v.object({ id: v.string() })],
    ['v.looseObject', v.looseObject({ id: v.string() })],
    ['a piped v.object', v.pipe(v.object({ id: v.string() }), v.readonly())],
  ])('rejects a %s input, naming the method', (_, input) => {
    expect(() => toolsetWithInput(input)).toThrow(
      'Toolset method "probe.run" must declare its input with v.strictObject'
    );
  });

  it('accepts a v.strictObject input, piped or not', () => {
    expect(() => toolsetWithInput(v.strictObject({ id: v.string() }))).not.toThrow();
    expect(() =>
      toolsetWithInput(v.pipe(v.strictObject({ id: v.string() }), v.readonly()))
    ).not.toThrow();
  });

  it('leaves a non-valibot Standard Schema to its own vendor', () => {
    const input: StandardSchemaV1 = {
      '~standard': { version: 1, vendor: 'other', validate: (value) => ({ value }) },
    };

    expect(() => toolsetWithInput(input)).not.toThrow();
  });
});

describe('invokeToolsetMethod', () => {
  const signalProbe = defineToolset({
    id: 'probe',
    description: 'Probe toolset.',
    methods: {
      signal: {
        title: 'Signal',
        description: 'Reports the signal it was handed.',
        input: v.strictObject({}),
        handler: (_, ctx) => ({
          ok: true,
          data: { isSignal: ctx.signal instanceof AbortSignal, aborted: ctx.signal.aborted },
          markdown: '',
        }),
      },
    },
  });
  const aborted = AbortSignal.abort();

  it.each([
    { name: 'no signal', input: {}, expected: { isSignal: true, aborted: false } },
    {
      name: 'an aborted signal',
      input: { signal: aborted },
      expected: { isSignal: true, aborted: true },
    },
  ])('hands the handler a signal when given $name', async ({ input, expected }) => {
    const outcome = await invokeToolsetMethod(
      signalProbe,
      'signal',
      {},
      {
        transport: 'sdk',
        getService: () => ({}) as never,
        ...input,
      }
    );

    expect(outcome.data).toEqual(expected);
  });
});
