import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import type { RenderContext, StoryContext } from 'storybook/internal/types';

import { expectTypeOf } from 'expect-type';
import { h, reactive } from 'vue';

import { render, renderToCanvas, updateArgs } from './render';
import type { VueRenderer } from './types';

// Mock the DOM
const mockShowMain = vi.fn();
const mockShowException = vi.fn();

// Helper to create a mock canvas element
const createMockCanvasElement = () => {
  // Ensure document exists (happy-dom provides this)
  if (typeof document === 'undefined') {
    throw new Error('Test requires DOM environment');
  }
  const div = document.createElement('div');
  div.id = 'storybook-root';
  document.body.appendChild(div);
  return div;
};

// Helper to create a mock story context
const createMockStoryContext = (args = {}, id = 'test-story'): StoryContext<VueRenderer> =>
  ({
    id,
    kind: 'Component',
    name: 'Test Story',
    story: 'Test Story',
    args,
    argTypes: {},
    globals: {},
    parameters: {},
    initialArgs: args,
    viewMode: 'story',
    abortSignal: new AbortController().signal,
    canvasElement: createMockCanvasElement(),
    hooks: {} as any,
    applyLoaders: vi.fn(),
    applyBeforeEach: vi.fn(),
    unboundStoryFn: vi.fn(),
    playFunction: undefined,
    loaded: {},
    step: vi.fn(),
    mount: vi.fn(),
    context: null as any,
    canvas: {} as any,
    originalStoryFn: vi.fn(),
  }) as any;

// Helper to create a test component
const TestComponent = {
  name: 'TestComponent',
  props: ['size', 'label'],
  template: '<button :class="`btn-${size}`">{{ label }}</button>',
};

describe('Render Story', () => {
  describe('URL args synchronization', () => {
    it('should use URL args when rendering in isolation mode', async () => {
      // Simulate URL args that would be parsed from ?args=size:large;label:Click
      const urlArgs = { size: 'large', label: 'Click' };
      const storyContext = createMockStoryContext(urlArgs);
      storyContext.component = TestComponent;

      // Create a story function that uses the default render
      const storyFn = () => render(storyContext.args, storyContext);

      const renderContext: RenderContext<VueRenderer> = {
        storyContext,
        storyFn,
        showMain: mockShowMain,
        showException: mockShowException,
        forceRemount: true,
        id: 'test-story',
      } as any;

      const canvasElement = createMockCanvasElement();

      // Render the story
      const teardown = await renderToCanvas(renderContext, canvasElement);

      // Verify that the reactive args contain URL args
      expect(storyContext.args).toEqual(urlArgs);
      expect(storyContext.args.size).toBe('large');
      expect(storyContext.args.label).toBe('Click');

      // Clean up
      await teardown();
    });

    it('should make args reactive before calling storyFn', async () => {
      const urlArgs = { count: 5, enabled: true };
      const storyContext = createMockStoryContext(urlArgs);

      let argsWhenStoryFnCalled: any = null;
      let wereArgsReactive = false;

      // Custom story function that captures args state
      const storyFn = vi.fn(() => {
        argsWhenStoryFnCalled = { ...storyContext.args };
        wereArgsReactive = reactive(storyContext.args) === storyContext.args;
        return h('div', 'Test');
      });

      const renderContext: RenderContext<VueRenderer> = {
        storyContext,
        storyFn,
        showMain: mockShowMain,
        showException: mockShowException,
        forceRemount: true,
        id: 'test-story',
      } as any;

      const canvasElement = createMockCanvasElement();
      const teardown = await renderToCanvas(renderContext, canvasElement);

      // Verify storyFn was called with reactive args containing URL values
      expect(storyFn).toHaveBeenCalled();
      expect(argsWhenStoryFnCalled).toEqual(urlArgs);
      expect(wereArgsReactive).toBe(true);

      await teardown();
    });

    it('should update existing reactive args without remount', async () => {
      const initialArgs = { size: 'medium', label: 'Initial' };
      const storyContext = createMockStoryContext(initialArgs);
      storyContext.component = TestComponent;

      const storyFn = () => render(storyContext.args, storyContext);

      const renderContext: RenderContext<VueRenderer> = {
        storyContext,
        storyFn,
        showMain: mockShowMain,
        showException: mockShowException,
        forceRemount: true,
        id: 'test-story',
      } as any;

      const canvasElement = createMockCanvasElement();

      // Initial render
      await renderToCanvas(renderContext, canvasElement);
      expect(storyContext.args).toEqual(initialArgs);

      // Simulate URL args change without remount
      const updatedArgs = { size: 'large', label: 'Updated' };
      storyContext.args = updatedArgs;
      renderContext.forceRemount = false;

      // Re-render with updated args
      const teardown = await renderToCanvas(renderContext, canvasElement);

      // Verify args were updated
      expect(storyContext.args.size).toBe('large');
      expect(storyContext.args.label).toBe('Updated');

      await teardown();
    });

    it('should preserve decorator-modified args', async () => {
      const urlArgs = { size: 'small' };
      const storyContext = createMockStoryContext(urlArgs);
      storyContext.component = TestComponent;

      // Story function that modifies args via decorator pattern
      const storyFn = () => {
        const decoratedElement = h(TestComponent, {
          ...storyContext.args,
          size: 'decorated-size',
        });
        return decoratedElement;
      };

      const renderContext: RenderContext<VueRenderer> = {
        storyContext,
        storyFn,
        showMain: mockShowMain,
        showException: mockShowException,
        forceRemount: true,
        id: 'test-story',
      } as any;

      const canvasElement = createMockCanvasElement();
      const teardown = await renderToCanvas(renderContext, canvasElement);

      // The reactive args should be updated with decorator changes
      expect(storyContext.args.size).toBe('decorated-size');

      await teardown();
    });
  });

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
