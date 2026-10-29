import { describe, expect, it } from 'vitest';

import * as v from 'valibot';

import {
  OpenServiceDuplicateToolNameError,
  OpenServiceDuplicateToolsetError,
  OpenServiceMissingToolsetError,
  StorybookInstanceUnavailableError,
} from '../../server-errors.ts';
import {
  createTestInstanceContext,
  runInTestInstance,
  useTestInstance,
} from '../instance-context.test-helpers.ts';
import { getInstanceContext } from '../instance-context.ts';
import { defineToolset } from './toolset-definition.ts';
import {
  clearToolsetRegistry,
  getRegisteredToolsets,
  getToolset,
  registerToolset,
} from './toolset-registry.ts';

const makeToolset = (id: string, description = `${id} toolset`) =>
  defineToolset({
    id,
    description,
    methods: {
      noop: {
        title: 'No-op',
        description: 'No-op method.',
        input: v.strictObject({}),
        handler: () =>
          ({ ok: true, data: getInstanceContext()?.workingDir, markdown: '' }) as const,
      },
    },
  });

const ids = (): string[] => getRegisteredToolsets().map((toolset) => toolset.id);

describe('registerToolset', () => {
  useTestInstance();

  it('registers toolsets and returns them in registration order', () => {
    registerToolset(makeToolset('docs'));
    registerToolset(makeToolset('review'));

    expect(ids()).toEqual(['docs', 'review']);
  });

  it('throws on a duplicate id: two hosts claiming one public surface is mis-wiring', () => {
    registerToolset(makeToolset('docs', 'first'));

    expect(() => registerToolset(makeToolset('docs', 'second'))).toThrow(
      OpenServiceDuplicateToolsetError
    );
  });

  it('throws when two methods in one toolset collapse to the same CLI name', () => {
    const colliding = defineToolset({
      id: 'widgets',
      description: 'Widgets',
      methods: {
        getHTTPFrame: {
          title: 'HTTP',
          description: 'a',
          input: v.strictObject({}),
          handler: () => ({ ok: true, data: undefined, markdown: '' }) as const,
        },
        getHttpFrame: {
          title: 'Http',
          description: 'b',
          input: v.strictObject({}),
          handler: () => ({ ok: true, data: undefined, markdown: '' }) as const,
        },
      },
    });

    expect(() => registerToolset(colliding)).toThrow(OpenServiceDuplicateToolNameError);
  });

  it('throws when two toolsets derive the same MCP tool name', () => {
    registerToolset(
      defineToolset({
        id: 'fooBar',
        description: 'a',
        methods: {
          baz: {
            title: 'Baz',
            description: 'a',
            input: v.strictObject({}),
            handler: () => ({ ok: true, data: undefined, markdown: '' }) as const,
          },
        },
      })
    );

    expect(() =>
      registerToolset(
        defineToolset({
          id: 'foo',
          description: 'b',
          methods: {
            barBaz: {
              title: 'Bar baz',
              description: 'b',
              input: v.strictObject({}),
              handler: () => ({ ok: true, data: undefined, markdown: '' }) as const,
            },
          },
        })
      )
    ).toThrow(OpenServiceDuplicateToolNameError);
  });

  it('returns an empty list before any registration', () => {
    expect(getRegisteredToolsets()).toEqual([]);
  });

  it('clears the current instance toolsets', () => {
    registerToolset(makeToolset('docs'));
    clearToolsetRegistry();

    expect(getRegisteredToolsets()).toEqual([]);
  });
});

describe('getToolset', () => {
  useTestInstance();

  it('returns a registered toolset by id', () => {
    registerToolset(makeToolset('docs'));

    expect(getToolset('docs')).toMatchObject({ id: 'docs', description: 'docs toolset' });
  });

  it('throws for an unregistered id instead of returning an empty result', () => {
    expect(() => getToolset('stories')).toThrow(OpenServiceMissingToolsetError);
  });
});

describe('instance scope', () => {
  it.each([
    { name: 'registerToolset', call: () => registerToolset(makeToolset('docs')) },
    { name: 'getToolset', call: () => getToolset('docs') },
    { name: 'getRegisteredToolsets', call: () => getRegisteredToolsets() },
    { name: 'clearToolsetRegistry', call: () => clearToolsetRegistry() },
  ])('$name throws outside an instance', ({ name, call }) => {
    expect(call).toThrow(StorybookInstanceUnavailableError);
    expect(call).toThrow(`${name}() was called outside a Storybook instance.`);
  });

  it('keeps each instance toolsets apart', async () => {
    const first = createTestInstanceContext('/first');
    const second = createTestInstanceContext('/second');

    await runInTestInstance(() => registerToolset(makeToolset('docs')), first);
    await runInTestInstance(() => registerToolset(makeToolset('review')), second);

    await expect(runInTestInstance(ids, first)).resolves.toEqual(['docs']);
    await expect(runInTestInstance(ids, second)).resolves.toEqual(['review']);
  });

  it('runs handlers in the registering instance even when called outside it', async () => {
    const toolset = await runInTestInstance(() => {
      registerToolset(makeToolset('widgets'));
      return getToolset('widgets');
    }, createTestInstanceContext('/owner'));

    const outcome = await toolset.methods.noop.handler({}, { transport: 'sdk' } as never);

    expect(outcome.data).toBe('/owner');
  });
});
