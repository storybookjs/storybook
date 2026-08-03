import { beforeEach, describe, expect, it } from 'vitest';

import * as v from 'valibot';

import { defineToolset } from './toolset-definition.ts';
import {
  clearToolsetRegistry,
  getRegisteredToolsets,
  registerToolset,
} from './toolset-registry.ts';

const makeToolset = (id: string, description = `${id} toolset`) =>
  defineToolset({
    id,
    description,
    methods: {
      noop: {
        description: 'No-op method.',
        schema: v.object({}),
        handler: () => undefined,
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

  it('is idempotent by id: the first registration wins', () => {
    const first = makeToolset('docs', 'first');
    const second = makeToolset('docs', 'second');

    registerToolset(first);
    registerToolset(second);

    expect(getRegisteredToolsets()).toEqual([first]);
  });

  it('returns an empty list before any registration', () => {
    expect(getRegisteredToolsets()).toEqual([]);
  });
});
