import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/client-logger';

import { inferArgTypes } from './inferArgTypes.ts';

vi.mock('storybook/internal/client-logger');

describe('inferArgTypes', () => {
  beforeEach(() => {
    vi.mocked(logger.warn).mockClear();
  });

  it('infers scalar types', () => {
    expect(
      inferArgTypes({
        initialArgs: {
          a: true,
          b: 'string',
          c: 1,
          d: () => {},
          e: Symbol('foo'),
        },
      } as any)
    ).toEqual({
      a: { name: 'a', type: { name: 'boolean' } },
      b: { name: 'b', type: { name: 'string' } },
      c: { name: 'c', type: { name: 'number' } },
      d: { name: 'd', type: { name: 'function' } },
      e: { name: 'e', type: { name: 'symbol' } },
    });
  });

  it('infers array types', () => {
    expect(
      inferArgTypes({
        initialArgs: {
          a: [1, 2, 3],
          b: ['a', 'b', 'c'],
          c: [],
        },
      } as any)
    ).toEqual({
      a: { name: 'a', type: { name: 'array', value: { name: 'number' } } },
      b: { name: 'b', type: { name: 'array', value: { name: 'string' } } },
      c: { name: 'c', type: { name: 'array', value: { name: 'other', value: 'unknown' } } },
    });
  });

  it('infers object types', () => {
    expect(
      inferArgTypes({
        initialArgs: {
          a: {
            x: 'string',
            y: 1,
          },
        },
      } as any)
    ).toEqual({
      a: {
        name: 'a',
        type: { name: 'object', value: { x: { name: 'string' }, y: { name: 'number' } } },
      },
    });
  });

  it('infers nested types', () => {
    expect(
      inferArgTypes({
        initialArgs: {
          a: [
            {
              x: 'string',
            },
          ],
        },
      } as any)
    ).toEqual({
      a: {
        name: 'a',
        type: { name: 'array', value: { name: 'object', value: { x: { name: 'string' } } } },
      },
    });
  });

  it('avoid cycles', () => {
    const cyclic: any = {};
    cyclic.foo = cyclic;

    expect(
      inferArgTypes({
        initialArgs: {
          a: cyclic,
        },
      } as any)
    ).toEqual({
      a: {
        name: 'a',
        type: { name: 'object', value: { foo: { name: 'other', value: 'cyclic object' } } },
      },
    });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('does not warn on cyclic args that define toJSON', () => {
    // Repro from issue #35239: a Backbone-style collection holds a cyclic
    // back-reference but defines toJSON, so its serialized output is finite.
    const cyclic: any = { id: 1, name: 'item' };
    cyclic.self = cyclic;
    const collection = {
      models: [cyclic],
      toJSON() {
        return [{ id: 1, name: 'item' }];
      },
    };

    expect(
      inferArgTypes({
        initialArgs: {
          collection,
        },
      } as any)
    ).toEqual({
      collection: {
        name: 'collection',
        type: {
          name: 'array',
          value: { name: 'object', value: { id: { name: 'number' }, name: { name: 'string' } } },
        },
      },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('falls back to normal inference when toJSON throws', () => {
    const value = {
      x: 1,
      toJSON() {
        throw new Error('serialization unavailable');
      },
    };

    expect(
      inferArgTypes({
        initialArgs: { a: value },
      } as any)
    ).toEqual({
      a: {
        name: 'a',
        type: {
          name: 'object',
          // The `toJSON` method itself is walked as a function field.
          value: { x: { name: 'number' }, toJSON: { name: 'function' } },
        },
      },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('memoizes the inferred type across repeated references to the same toJSON arg', () => {
    // Verifies the toJSON branch writes to the shared cache so repeated
    // references to the same value reuse the previous inference instead of
    // re-running toJSON() and walking the serialized output again.
    const toJSON = vi.fn(() => ({ id: 1 }));
    const shared = { foo: 'bar', toJSON };

    inferArgTypes({
      initialArgs: {
        a: shared,
        b: shared,
      },
    } as any);
    expect(toJSON).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('falls back to cycle detection when toJSON returns the value itself', () => {
    // A toJSON that returns `this` must not cause infinite recursion; the
    // existing cycle path should still fire.
    const cyclic: any = {};
    cyclic.foo = cyclic;
    cyclic.toJSON = function () {
      return this;
    };

    inferArgTypes({
      initialArgs: { a: cyclic },
    } as any);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('ensures names', () => {
    expect(
      inferArgTypes({
        initialArgs: {
          a: 1,
        },
        argTypes: {
          a: {
            control: {
              type: 'range',
            },
          },
        },
      } as any)
    ).toEqual({
      a: {
        name: 'a',
        type: { name: 'number' },
        control: { type: 'range' },
      },
    });
  });

  it('ensures names even with no arg', () => {
    expect(
      inferArgTypes({
        argTypes: {
          a: {
            type: {
              name: 'string',
            },
          },
        },
      } as any)
    ).toEqual({
      a: {
        name: 'a',
        type: { name: 'string' },
      },
    });
  });

  it('does not infer types for args that already have an argType', () => {
    expect(
      inferArgTypes({
        initialArgs: {
          size: 'large',
        },
        argTypes: {
          size: {
            type: {
              name: 'enum',
              value: ['small', 'medium', 'large'],
            },
          },
        },
      } as any)
    ).toEqual({
      size: {
        name: 'size',
        type: { name: 'enum', value: ['small', 'medium', 'large'] },
      },
    });
  });
});
