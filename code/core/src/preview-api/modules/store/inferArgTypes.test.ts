import { describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/client-logger';

import { inferArgTypes } from './inferArgTypes.ts';

vi.mock('storybook/internal/client-logger');

describe('inferArgTypes', () => {
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

    vi.mocked(logger.warn).mockClear();
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

  it('ensures names', () => {
    vi.mocked(logger.warn).mockClear();
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
    vi.mocked(logger.warn).mockClear();
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

  it('uses toJSON() result for cyclic objects that define a valid toJSON()', () => {
    const cyclic: any = { a: 1 };
    cyclic.self = cyclic;
    Object.defineProperty(cyclic, 'toJSON', {
      value: () => ({ a: 1, self: 'cyclic reference' }),
      enumerable: false,
    });

    vi.mocked(logger.warn).mockClear();
    expect(
      inferArgTypes({
        initialArgs: { a: cyclic },
      } as any)
    ).toEqual({
      a: {
        name: 'a',
        type: {
          name: 'object',
          value: { a: { name: 'number' }, self: { name: 'string' } },
        },
      },
    });
    expect(logger.warn).not.toHaveBeenCalled();
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
  it('uses JSON serialization semantics for key-aware toJSON on cyclic args', () => {
    const cyclic: any = { a: 1 };
    cyclic.self = cyclic;
    Object.defineProperty(cyclic, 'toJSON', {
      value: (key: string) => (key === 'a' ? { a: 1, self: 'cyclic reference' } : cyclic),
      enumerable: false,
    });

    vi.mocked(logger.warn).mockClear();
    expect(inferArgTypes({ initialArgs: { a: cyclic } } as any)).toEqual({
      a: {
        name: 'a',
        type: {
          name: 'object',
          value: { a: { name: 'number' }, self: { name: 'string' } },
        },
      },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('uses JSON serialization semantics for nested toJSON in cyclic args', () => {
    const child: any = { value: 'child' };
    child.self = child;
    Object.defineProperty(child, 'toJSON', {
      value: (key: string) =>
        key === 'child' ? { value: 'child', self: 'cyclic reference' } : child,
      enumerable: false,
    });

    const wrapper = { child };

    vi.mocked(logger.warn).mockClear();
    expect(inferArgTypes({ initialArgs: { wrapper } } as any)).toEqual({
      wrapper: {
        name: 'wrapper',
        type: {
          name: 'object',
          value: {
            child: {
              name: 'object',
              value: {
                value: { name: 'string' },
                self: { name: 'string' },
              },
            },
          },
        },
      },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
