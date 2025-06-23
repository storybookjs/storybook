import { describe, expect, it } from 'vitest';

import { expectTypeOf } from 'expect-type';
import { reactive } from 'vue';

import { updateArgs } from './render';

describe('Render Story', () => {
  it('update reactive Args updateArgs()', () => {
    const reactiveArgs = reactive({ argFoo: 'foo', argBar: 'bar' }); // get reference to reactiveArgs or create a new one;
    expectTypeOf(reactiveArgs).toMatchTypeOf<Record<string, any>>();
    expectTypeOf(reactiveArgs).toEqualTypeOf<{ argFoo: string; argBar: string }>();

    const newArgs = { argFoo: 'foo2', argBar: 'bar2' };
    updateArgs(reactiveArgs, newArgs);
    expectTypeOf(reactiveArgs).toEqualTypeOf<{ argFoo: string; argBar: string }>();
    expect(reactiveArgs).toEqual({ argFoo: 'foo2', argBar: 'bar2' });
  });

  it('update reactive Args component inherit objectArg updateArgs()', () => {
    const reactiveArgs = reactive({ objectArg: { argFoo: 'foo', argBar: 'bar' } }); // get reference to reactiveArgs or create a new one;
    expectTypeOf(reactiveArgs).toMatchTypeOf<Record<string, any>>();
    expectTypeOf(reactiveArgs).toEqualTypeOf<{ objectArg: { argFoo: string; argBar: string } }>();

    const newArgs = { argFoo: 'foo2', argBar: 'bar2' };
    updateArgs(reactiveArgs, newArgs);
    expectTypeOf(reactiveArgs).toEqualTypeOf<{ objectArg: { argFoo: string; argBar: string } }>();
    expect(reactiveArgs).toEqual({
      argFoo: 'foo2',
      argBar: 'bar2',
    });
  });

  it('update reactive Args component inherit objectArg', () => {
    const reactiveArgs = reactive({ objectArg: { argFoo: 'foo' } }); // get reference to reactiveArgs or create a new one;
    expectTypeOf(reactiveArgs).toMatchTypeOf<Record<string, any>>();
    expectTypeOf(reactiveArgs).toEqualTypeOf<{ objectArg: { argFoo: string } }>();

    const newArgs = { argFoo: 'foo2', argBar: 'bar2' };
    updateArgs(reactiveArgs, newArgs);
    expect(reactiveArgs).toEqual({ argFoo: 'foo2', argBar: 'bar2' });
  });

  it('update reactive Args component 2 object args  ->  updateArgs()', () => {
    const reactiveArgs = reactive({
      objectArg: { argFoo: 'foo' },
      objectArg2: { argBar: 'bar' },
    }); // get reference to reactiveArgs or create a new one;
    expectTypeOf(reactiveArgs).toMatchTypeOf<Record<string, any>>();
    expectTypeOf(reactiveArgs).toEqualTypeOf<{
      objectArg: { argFoo: string };
      objectArg2: { argBar: string };
    }>();

    const newArgs = { argFoo: 'foo2', argBar: 'bar2' };
    updateArgs(reactiveArgs, newArgs);

    expect(reactiveArgs).toEqual({
      argFoo: 'foo2',
      argBar: 'bar2',
    });
  });

  it('update reactive Args component object with object  ->  updateArgs()', () => {
    const reactiveArgs = reactive({
      objectArg: { argFoo: 'foo' },
    }); // get reference to reactiveArgs or create a new one;
    expectTypeOf(reactiveArgs).toMatchTypeOf<Record<string, any>>();
    expectTypeOf(reactiveArgs).toEqualTypeOf<{
      objectArg: { argFoo: string };
    }>();

    const newArgs = { objectArg: { argFoo: 'bar' } };
    updateArgs(reactiveArgs, newArgs);

    expect(reactiveArgs).toEqual({ objectArg: { argFoo: 'bar' } });
  });

  it('update reactive Args component no arg with all args -> updateArgs()', () => {
    const reactiveArgs = reactive({ objectArg: { argFoo: 'foo' } }); // get reference to reactiveArgs or create a new one;
    expectTypeOf(reactiveArgs).toMatchTypeOf<Record<string, any>>();
    expectTypeOf(reactiveArgs).toEqualTypeOf<{
      objectArg: { argFoo: string };
    }>();

    const newArgs = { objectArg: { argFoo: 'bar' } };
    updateArgs(reactiveArgs, newArgs);

    expect(reactiveArgs).toEqual({ objectArg: { argFoo: 'bar' } });
  });
});
