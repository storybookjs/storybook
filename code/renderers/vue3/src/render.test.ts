// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import type {
  Args,
  DecoratorFunction,
  Globals,
  RenderContext,
  StoryContext,
  StrictArgTypes,
} from 'storybook/internal/types';

import { expectTypeOf } from 'expect-type';
import {
  computed,
  createApp,
  defineComponent,
  h,
  KeepAlive,
  nextTick,
  onActivated,
  reactive,
  resolveComponent,
  type VNode,
} from 'vue';

import { decorateStory } from './decorateStory.ts';
import { render, renderToCanvas, updateArgs } from './render.ts';
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
  const slotNames = (argTypes: StrictArgTypes = {}) => {
    const storyFn = render(args, {
      id: 'layout--default',
      component: Layout,
      argTypes,
    } as unknown as StoryContext<VueRenderer>) as () => VNode;
    const vnode = storyFn();
    return Object.keys((vnode.children ?? {}) as object).filter((key) => !key.startsWith('_'));
  };

  it('passes every arg that is neither a declared prop nor a listener as a slot', () => {
    expect(slotNames()).toEqual(['default', 'footer']);
  });

  it('passes an arg named like a declared prop to the prop, even with a slot argType', () => {
    expect(slotNames({ label: { name: 'label', table: { category: 'slots' } } })).toEqual([
      'default',
      'footer',
    ]);
  });
});

describe('renderToCanvas', () => {
  it('ends on showException when a decorator throws during mount', async () => {
    const error = new Error('Story did something wrong');
    const storyContext = { args: {}, globals: {} } as unknown as StoryContext<VueRenderer>;
    const storyFn = decorateStory(
      () => ({ render: () => null }),
      [
        () => {
          throw error;
        },
      ]
    );
    const calls: unknown[][] = [];
    // Vue warns that the app has no render function once its setup throws.
    vi.spyOn(console, 'warn').mockImplementationOnce(() => {});

    const teardown = await renderToCanvas(
      {
        id: 'error-story',
        storyContext,
        storyFn: () => storyFn(storyContext),
        forceRemount: true,
        showMain: () => calls.push(['showMain']),
        showException: (e: Error) => calls.push(['showException', e]),
      } as unknown as RenderContext<VueRenderer>,
      document.createElement('div')
    );
    teardown();

    expect(calls.at(-1)).toEqual(['showException', error]);
  });

  it('shows main again when an args update repairs a component that threw on mount', async () => {
    const Label = defineComponent({
      props: ['label'],
      render() {
        if (this.label === 'boom') {
          throw new Error('Story did something wrong');
        }
        return h('span', this.label);
      },
    });
    const calls: string[] = [];
    const renderContext = (args: Args, forceRemount: boolean) => {
      const storyContext = {
        id: 'label--default',
        component: Label,
        args,
        argTypes: {},
        globals: {},
      } as unknown as StoryContext<VueRenderer>;
      return {
        id: 'label--default',
        storyContext,
        storyFn: () => render(storyContext.args, storyContext),
        forceRemount,
        showMain: () => calls.push('showMain'),
        showException: () => calls.push('showException'),
      } as unknown as RenderContext<VueRenderer>;
    };
    const canvasElement = document.createElement('div');

    await renderToCanvas(renderContext({ label: 'boom' }, true), canvasElement);
    const teardown = await renderToCanvas(
      renderContext({ label: 'Repaired' }, false),
      canvasElement
    );
    await nextTick();

    expect(canvasElement.textContent).toBe('Repaired');
    teardown();
    expect(calls).toEqual(['showMain', 'showException', 'showMain']);
  });
});

describe('decorateStory', () => {
  const storyContext = { args: {}, globals: {} } as unknown as StoryContext<VueRenderer>;
  const mountDecorated = (
    story: VueRenderer['storyResult'],
    decorator: DecoratorFunction<VueRenderer>
  ) => {
    const decorated = decorateStory(() => story, [decorator])(storyContext);
    const canvasElement = document.createElement('div');
    const app = createApp({ render: () => h(decorated) });
    app.mount(canvasElement);
    return { canvasElement, unmount: () => app.unmount() };
  };

  it('keeps the story alive when a decorator wraps it in <KeepAlive>', async () => {
    const calls: string[] = [];
    const story = defineComponent({
      setup() {
        onActivated(() => calls.push('activated'));
        return () => h('p', 'story');
      },
    });

    const { unmount } = mountDecorated(story, () => ({
      render: () => h(KeepAlive, null, [h(resolveComponent('story'))]),
    }));
    await nextTick();

    expect(calls).toEqual(['activated']);
    unmount();
  });

  it('passes only class, style and listeners from the story tag to the story', () => {
    const story = defineComponent({
      inheritAttrs: false,
      render() {
        return h('p', Object.keys(this.$attrs).sort().join(','));
      },
    });

    const { canvasElement, unmount } = mountDecorated(story, () => ({
      render: () =>
        h(resolveComponent('story'), {
          class: 'wrapped',
          style: 'color: red',
          onClick: () => {},
          title: 'not passed',
        }),
    }));

    expect(canvasElement.textContent).toBe('class,onClick,style');
    unmount();
  });
});
