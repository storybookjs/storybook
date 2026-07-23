import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearPublicApiRegistry,
  defineApi,
  invokeApi,
  publicApi,
  registerPublicApi,
} from './index.ts';

const exampleApi = defineApi({
  id: 'example',
  description: 'Example API',
  methods: {
    greet: {
      description: 'Greets a person.',
      schema: v.object({ name: v.string() }),
      handler: async ({ name }) => `Hello ${name}`,
    },
  },
});

afterEach(() => {
  clearPublicApiRegistry();
});

describe('public API registry', () => {
  it('registers APIs and resolves them by definition reference', () => {
    registerPublicApi([exampleApi]);

    expect(publicApi(exampleApi)).toBe(exampleApi);
  });

  it('rejects an unregistered definition that reuses a registered id', () => {
    registerPublicApi([exampleApi]);
    const unregisteredApi = defineApi({
      id: 'example',
      description: 'Different API definition',
      methods: {},
    });

    expect(() => publicApi(unregisteredApi)).toThrow();
  });

  it('allows registering the same definition more than once', () => {
    registerPublicApi([exampleApi]);

    expect(() => registerPublicApi([exampleApi])).not.toThrow();
  });

  it('rejects a different definition with a registered id', () => {
    registerPublicApi([exampleApi]);

    expect(() =>
      registerPublicApi([
        defineApi({
          id: 'example',
          description: 'Conflicting API',
          methods: {},
        }),
      ])
    ).toThrow();
  });

  it('validates method input before calling its handler', async () => {
    const handler = vi.fn(async ({ name }: { name: string }) => `Hello ${name}`);
    const api = defineApi({
      id: 'validation',
      description: 'Validation API',
      methods: {
        greet: {
          description: 'Greets a person.',
          schema: v.object({ name: v.string() }),
          handler,
        },
      },
    });

    await expect(invokeApi(api, 'greet', { name: 42 })).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();
    await expect(invokeApi(api, 'greet', { name: 'Ada' })).resolves.toBe('Hello Ada');
  });

  it('passes the invoking consumer to method handlers', async () => {
    const reviewApi = defineApi({
      id: 'review',
      description: 'Review API',
      methods: {
        create: {
          description: 'Creates a review.',
          schema: v.object({ storyIds: v.array(v.string()) }),
          handler: async (_input, { consumer }) => consumer,
        },
      },
    });

    await expect(
      invokeApi(reviewApi, 'create', { storyIds: ['example--story'] }, { consumer: 'cli' })
    ).resolves.toBe('cli');
  });

  it('propagates method handler errors', async () => {
    const error = new Error('handler failed');
    const api = defineApi({
      id: 'errors',
      description: 'Error API',
      methods: {
        fail: {
          description: 'Fails.',
          schema: v.undefined(),
          handler: async () => {
            throw error;
          },
        },
      },
    });

    await expect(invokeApi(api, 'fail', undefined)).rejects.toBe(error);
  });
});
