import { describe, expect, it } from 'vitest';

import type { Args, Globals, StoryContext } from 'storybook/internal/types';

import { expectTypeOf } from 'expect-type';
import { computed, reactive } from 'vue';

import { getSlots, updateArgs } from './render.ts';
import type { VueRenderer } from './types.ts';

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
    updateArgs<Args>(reactiveArgs, newArgs);
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
    updateArgs<Args>(reactiveArgs, newArgs);
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
    updateArgs<Args>(reactiveArgs, newArgs);

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

  it('clears all args when nextArgs is empty -> updateArgs()', () => {
    const reactiveArgs = reactive({ argFoo: 'foo', argBar: 'bar' });
    updateArgs(reactiveArgs, {} as any);
    expect(reactiveArgs).toEqual({});
  });

  it('update reactive Globals', async () => {
    const reactiveGlobals = reactive<Globals>({ theme: 'light', locale: 'en' });

    let observedTheme: string | undefined;
    const watcher = computed(() => {
      observedTheme = reactiveGlobals.theme as string;
      return reactiveGlobals.theme;
    });

    expect(watcher.value).toBe('light');
    expect(observedTheme).toBe('light');

    updateArgs<Globals>(reactiveGlobals, { theme: 'dark', locale: 'en' });

    expect(watcher.value).toBe('dark');
    expect(observedTheme).toBe('dark');
    expect(reactiveGlobals).toEqual({ theme: 'dark', locale: 'en' });
  });
});

describe('getSlots', () => {
  const contextWith = (argTypes: StoryContext<VueRenderer, Args>['argTypes']) =>
    ({ argTypes }) as StoryContext<VueRenderer, Args>;

  it('maps args categorized as slots into slot render functions', () => {
    const slots = getSlots(
      { default: 'Hello slot', label: 'plain prop' },
      contextWith({
        default: { name: 'default', table: { category: 'slots' } },
        label: { name: 'label', table: { category: 'props' } },
      })
    );

    expect(Object.keys(slots)).toEqual(['default']);
    expect(slots.default()).toBe('Hello slot');
  });

  it('passes function args through unchanged for function slots', () => {
    const renderFn = (bind: { num: number }) => `num=${bind.num}`;
    const slots = getSlots(
      { named: renderFn },
      contextWith({ named: { name: 'named', table: { category: 'slots' } } })
    );

    expect(slots.named).toBe(renderFn);
    expect(slots.named({ num: 123 })).toBe('num=123');
  });

  it('ignores args without the slots category', () => {
    const slots = getSlots(
      { label: 'plain' },
      contextWith({ label: { name: 'label', table: { category: 'props' } } })
    );

    expect(slots).toEqual({});
  });
});
