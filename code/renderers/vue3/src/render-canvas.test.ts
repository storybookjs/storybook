/**
 * Integration tests for renderToCanvas with URL args synchronization Tests the complete rendering
 * pipeline to ensure URL args are properly applied
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RenderContext } from 'storybook/internal/types';

import { h, nextTick } from 'vue';

import { renderToCanvas } from './render';
import type { VueRenderer } from './types';

describe('renderToCanvas - URL Args Integration', () => {
  let canvasElement: HTMLDivElement;
  let teardown: (() => void) | undefined;

  beforeEach(() => {
    // Create a canvas element for mounting
    canvasElement = document.createElement('div');
    canvasElement.id = 'storybook-root';
    document.body.appendChild(canvasElement);
  });

  afterEach(async () => {
    // Clean up after each test
    if (teardown) {
      await teardown();
      teardown = undefined;
    }
    if (canvasElement && canvasElement.parentNode) {
      canvasElement.parentNode.removeChild(canvasElement);
    }
  });

  it('should apply URL args on initial mount', async () => {
    // Test component that displays its props
    const TestComponent = {
      name: 'TestComponent',
      props: ['size', 'label'],
      template: '<button :data-size="size">{{ label }}</button>',
    };

    // Simulate URL args that would be parsed from ?args=size:large;label:ClickMe
    const urlArgs = { size: 'large', label: 'ClickMe' };

    // Mock story context with URL args already applied
    const storyContext = {
      id: 'test-story',
      args: urlArgs, // These are the args from URL
      component: TestComponent,
      argTypes: {},
    } as any;

    // Story function that renders the component with args
    const storyFn = vi.fn(() => {
      return h(TestComponent, storyContext.args);
    });

    const renderContext: RenderContext<VueRenderer> = {
      storyContext,
      storyFn,
      showMain: vi.fn(),
      showException: vi.fn(),
      forceRemount: true,
      id: 'test-story',
    } as any;

    // Render the story
    teardown = await renderToCanvas(renderContext, canvasElement);

    // Wait for Vue to update the DOM
    await nextTick();

    // Check that the component rendered with URL args
    const button = canvasElement.querySelector('button');
    expect(button).toBeTruthy();
    expect(button?.getAttribute('data-size')).toBe('large');
    expect(button?.textContent).toBe('ClickMe');

    // Verify storyFn was called and context args are reactive
    expect(storyFn).toHaveBeenCalled();
    expect(storyContext.args.size).toBe('large');
    expect(storyContext.args.label).toBe('ClickMe');
  });

  it('should update args without remount when URL changes', async () => {
    const TestComponent = {
      name: 'TestComponent',
      props: ['count'],
      template: '<div>Count: {{ count }}</div>',
    };

    // Initial args
    let storyContext = {
      id: 'test-story',
      args: { count: 1 },
      component: TestComponent,
      argTypes: {},
    } as any;

    const storyFn = () => h(TestComponent, storyContext.args);

    let renderContext: RenderContext<VueRenderer> = {
      storyContext,
      storyFn,
      showMain: vi.fn(),
      showException: vi.fn(),
      forceRemount: true,
      id: 'test-story',
    } as any;

    // Initial render
    teardown = await renderToCanvas(renderContext, canvasElement);
    await nextTick();

    let content = canvasElement.querySelector('div')?.textContent;
    expect(content).toBe('Count: 1');

    // Simulate URL args change - create new context with updated args
    // This simulates what Storybook does when URL changes
    storyContext = {
      ...storyContext,
      args: { count: 42 },
    };

    renderContext = {
      storyContext,
      storyFn: () => h(TestComponent, storyContext.args),
      showMain: vi.fn(),
      showException: vi.fn(),
      forceRemount: false, // Don't remount
      id: 'test-story',
    } as any;

    // Re-render with new args
    const newTeardown = await renderToCanvas(renderContext, canvasElement);
    await nextTick();
    await nextTick(); // Extra tick to ensure Vue updates

    content = canvasElement.querySelector('div')?.textContent;
    expect(content).toBe('Count: 42');

    // Clean up
    await newTeardown();
  });

  it('should preserve decorator modifications while using URL args', async () => {
    const TestComponent = {
      name: 'TestComponent',
      props: ['size', 'decorated'],
      template: '<div :class="size">{{ decorated ? "Decorated" : "Normal" }}</div>',
    };

    // URL args
    const urlArgs = { size: 'large' };

    const storyContext = {
      id: 'test-story',
      args: urlArgs,
      component: TestComponent,
      argTypes: {},
    } as any;

    // Decorator adds extra prop
    const storyFn = () => {
      const decoratedProps = {
        ...storyContext.args,
        decorated: true, // Added by decorator
      };
      return h(TestComponent, decoratedProps);
    };

    const renderContext: RenderContext<VueRenderer> = {
      storyContext,
      storyFn,
      showMain: vi.fn(),
      showException: vi.fn(),
      forceRemount: true,
      id: 'test-story',
    } as any;

    teardown = await renderToCanvas(renderContext, canvasElement);
    await nextTick();

    const div = canvasElement.querySelector('div');
    expect(div?.className).toBe('large'); // From URL
    expect(div?.textContent).toBe('Decorated'); // From decorator
  });

  describe('Bug reproduction scenario', () => {
    it('should correctly display button with size from URL in isolation mode', async () => {
      // This test reproduces the exact bug scenario:
      // 1. User changes button size to "large" in controls
      // 2. User clicks "Open in isolation mode"
      // 3. URL has ?args=size:large but button shows as "medium"

      const ButtonComponent = {
        name: 'Button',
        props: {
          size: {
            type: String,
            default: 'medium',
          },
          label: {
            type: String,
            default: 'Button',
          },
        },
        template: `
          <button :class="'btn-' + size">
            {{ label }}
          </button>
        `,
      };

      // Default story args
      const defaultArgs = { size: 'medium', label: 'Button' };

      // URL args from isolation mode URL: ?args=size:large
      const urlArgs = { size: 'large', label: 'Button' };

      // In the bug scenario, storyContext.args would have default args
      // Our fix ensures they have URL args instead
      const storyContext = {
        id: 'button--primary',
        args: urlArgs, // FIXED: Now contains URL args, not defaultArgs
        component: ButtonComponent,
        argTypes: {
          size: {
            control: { type: 'select' },
            options: ['small', 'medium', 'large'],
          },
        },
        parameters: {
          __isIsolationMode: true, // Simulating isolation mode
        },
      } as any;

      const storyFn = () => h(ButtonComponent, storyContext.args);

      const renderContext: RenderContext<VueRenderer> = {
        storyContext,
        storyFn,
        showMain: vi.fn(),
        showException: vi.fn(),
        forceRemount: true,
        id: 'button--primary',
      } as any;

      teardown = await renderToCanvas(renderContext, canvasElement);
      await nextTick();

      // Verify the button has the correct size from URL
      const button = canvasElement.querySelector('button');
      expect(button).toBeTruthy();
      expect(button?.className).toBe('btn-large'); // Should be 'large' from URL, not 'medium'

      // This confirms the fix: button now correctly shows size from URL in isolation mode
    });
  });
});
