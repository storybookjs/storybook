import { beforeEach, describe, expect, it } from 'vitest';

import * as v from 'valibot';

import {
  OpenServiceDuplicateToolNameError,
  OpenServiceDuplicateToolsetError,
  OpenServiceMissingToolsetError,
} from '../../server-errors.ts';
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
        input: v.object({}),
        handler: () => ({ ok: true, data: undefined, markdown: '' }) as const,
      },
    },
  });

beforeEach(() => {
  clearToolsetRegistry();
});

describe('registerToolset', () => {
  it('registers toolsets and returns them in registration order', () => {
    const docs = makeToolset('docs');
    const review = makeToolset('review');

    registerToolset(docs);
    registerToolset(review);

    expect(getRegisteredToolsets()).toEqual([docs, review]);
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
          input: v.object({}),
          handler: () => ({ ok: true, data: undefined, markdown: '' }) as const,
        },
        getHttpFrame: {
          title: 'Http',
          description: 'b',
          input: v.object({}),
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
            input: v.object({}),
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
              input: v.object({}),
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
});

describe('getToolset', () => {
  it('returns a registered toolset by id', () => {
    const docs = makeToolset('docs');
    registerToolset(docs);

    expect(getToolset('docs')).toBe(docs);
  });

  it('throws for an unregistered id instead of returning an empty result', () => {
    expect(() => getToolset('stories')).toThrow(OpenServiceMissingToolsetError);
  });
});
