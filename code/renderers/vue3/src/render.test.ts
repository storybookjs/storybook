import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Args, Globals, StoryContext } from 'storybook/internal/types';

import { expectTypeOf } from 'expect-type';
import { computed, defineComponent, h, reactive, type VNode } from 'vue';

import { render, updateArgs } from './render.ts';
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

describe('render slots', () => {
  const Layout = defineComponent({ props: ['label', 'is-open'], render: () => null });
  const args = {
    label: 'Storybook',
    isOpen: true,
    onClick: () => {},
    default: () => 'Default slot',
    footer: h('p', 'Footer'),
  };
  const slotNames = (argTypes: StoryContext<VueRenderer>['argTypes'] = {}) => {
    const storyFn = render(args, {
      id: 'layout--default',
      component: Layout,
      argTypes,
    } as unknown as StoryContext<VueRenderer>) as () => VNode;
    const vnode = storyFn();
    return Object.keys((vnode.children ?? {}) as object).filter((key) => !key.startsWith('_'));
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes args documented as slots by docgen', () => {
    expect(slotNames({ footer: { name: 'footer', table: { category: 'slots' } } })).toEqual([
      'footer',
    ]);
  });

  it('passes every undeclared, non-listener arg as a slot under server docgen', () => {
    vi.stubGlobal('FEATURES', { docgenServer: true });

    expect(slotNames()).toEqual(['default', 'footer']);
  });
});
