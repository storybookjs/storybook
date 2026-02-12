import { describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/client-logger';

import { inferArgTypes } from './inferArgTypes';

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

  it('handles Date, RegExp, and Error without warnings', () => {
    vi.mocked(logger.warn).mockClear();
    expect(
      inferArgTypes({
        initialArgs: {
          a: new Date('2024-01-01'),
          b: /test/gi,
          c: new Error('test'),
        },
      } as any)
    ).toEqual({
      a: { name: 'a', type: { name: 'other', value: 'Date' } },
      b: { name: 'b', type: { name: 'other', value: 'RegExp' } },
      c: { name: 'c', type: { name: 'other', value: 'Error' } },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns for Map and Set instances', () => {
    vi.mocked(logger.warn).mockClear();
    expect(
      inferArgTypes({
        initialArgs: {
          a: new Map([['key', 'value']]),
          b: new Set([1, 2, 3]),
        },
      } as any)
    ).toEqual({
      a: { name: 'a', type: { name: 'other', value: 'Map' } },
      b: { name: 'b', type: { name: 'other', value: 'Set' } },
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('non-serializable value'));
  });

  it('warns and skips non-plain objects (class instances)', () => {
    class MyClass {
      value = 42;
    }
    vi.mocked(logger.warn).mockClear();
    expect(
      inferArgTypes({
        initialArgs: {
          a: new MyClass(),
        },
      } as any)
    ).toEqual({
      a: { name: 'a', type: { name: 'other', value: 'MyClass' } },
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('non-serializable value'));
  });

  it('does not hang on DOM-like structures with many properties', () => {
    class FakeElement {
      nodeType = 1;
      nodeName = 'DIV';
      [key: string]: any;
      constructor() {
        for (let i = 0; i < 200; i++) {
          this[`attr${i}`] = `value${i}`;
        }
        this.__reactFiber = { child: this };
      }
    }
    const domLike = new FakeElement();

    const start = performance.now();
    const result = inferArgTypes({
      initialArgs: { el: domLike },
    } as any);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(result.el.type).toEqual({ name: 'other', value: 'FakeElement' });
  });

  it('does not hang on mutable refs pointing to complex objects', () => {
    class FakeHTMLFormElement {
      parentNode: any;
      __reactFiber: any;
      constructor() {
        this.parentNode = { childNodes: [this] };
        this.__reactFiber = { stateNode: this, return: {}, child: {} };
      }
    }
    const fakeDOM = new FakeHTMLFormElement();
    const ref = { current: fakeDOM };

    vi.mocked(logger.warn).mockClear();
    const start = performance.now();
    const result = inferArgTypes({
      initialArgs: { formRef: ref },
    } as any);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(result.formRef.type).toEqual({
      name: 'object',
      value: { current: { name: 'other', value: 'FakeHTMLFormElement' } },
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('non-serializable value'));
  });

  it('handles null and undefined args gracefully', () => {
    vi.mocked(logger.warn).mockClear();
    expect(
      inferArgTypes({
        initialArgs: {
          nullArg: null,
          undefinedArg: undefined,
        },
      } as any)
    ).toEqual({
      nullArg: { name: 'nullArg', type: { name: 'object', value: {} } },
      undefinedArg: { name: 'undefinedArg', type: { name: 'object', value: {} } },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
