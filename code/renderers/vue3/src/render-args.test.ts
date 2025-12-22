/**
 * Tests for URL args synchronization in Vue3 renderer This addresses the bug where URL args are not
 * applied to components in isolation mode
 */
import { describe, expect, it, vi } from 'vitest';

import type { RenderContext, StoryContext } from 'storybook/internal/types';

import { h, isReactive, reactive } from 'vue';

import { render, updateArgs } from './render';
import type { VueRenderer } from './types';

describe('Vue3 Renderer - URL Args Synchronization', () => {
  describe('updateArgs', () => {
    it('should update reactive args with URL parameters', () => {
      // Simulate args that would come from URL like ?args=size:large;label:Click
      const reactiveArgs = reactive({ size: 'medium', label: 'Button' });
      const urlArgs = { size: 'large', label: 'Click' };

      updateArgs(reactiveArgs, urlArgs);

      expect(reactiveArgs.size).toBe('large');
      expect(reactiveArgs.label).toBe('Click');
    });

    it('should add new args from URL', () => {
      const reactiveArgs = reactive({ size: 'medium' });
      const urlArgs = { size: 'large', label: 'New Label', disabled: true };

      updateArgs(reactiveArgs, urlArgs);

      expect(reactiveArgs.size).toBe('large');
      expect(reactiveArgs.label).toBe('New Label');
      expect(reactiveArgs.disabled).toBe(true);
    });

    it('should remove args not present in URL', () => {
      const reactiveArgs = reactive({ size: 'medium', label: 'Button', extra: 'value' });
      const urlArgs = { size: 'large' };

      updateArgs(reactiveArgs, urlArgs);

      expect(reactiveArgs.size).toBe('large');
      expect('label' in reactiveArgs).toBe(false);
      expect('extra' in reactiveArgs).toBe(false);
    });

    it('should handle empty URL args', () => {
      const reactiveArgs = reactive({ size: 'medium', label: 'Button' });
      const urlArgs = {};

      // Should not update when urlArgs is empty
      updateArgs(reactiveArgs, urlArgs);

      expect(reactiveArgs.size).toBe('medium');
      expect(reactiveArgs.label).toBe('Button');
    });
  });

  describe('render function with URL args', () => {
    it('should pass URL args to component', () => {
      const TestComponent = {
        name: 'TestComponent',
        props: ['size', 'label'],
        template: '<button>Test</button>',
      };

      // Simulate URL args
      const urlArgs = { size: 'large', label: 'Click Me' };
      const context: Partial<StoryContext<VueRenderer>> = {
        id: 'test-story',
        component: TestComponent,
        args: urlArgs,
        argTypes: {}, // Add argTypes to avoid undefined error
      };

      // Call render function with URL args
      const vnode = render(urlArgs, context as StoryContext<VueRenderer>);

      // The render function returns a function that creates the vnode
      const element = vnode();

      // Verify the component receives the URL args as props
      expect(element.type).toBe(TestComponent);
      expect(element.props?.size).toBe('large');
      expect(element.props?.label).toBe('Click Me');
    });

    it('should handle args with slots', () => {
      const TestComponent = {
        name: 'TestComponent',
        props: ['title'],
        template: '<div><slot></slot></div>',
      };

      const urlArgs = {
        title: 'From URL',
        default: 'Slot content from URL',
      };

      const context: Partial<StoryContext<VueRenderer>> = {
        id: 'test-story',
        component: TestComponent,
        args: urlArgs,
        argTypes: {
          default: { table: { category: 'slots' } },
        },
      };

      const vnode = render(urlArgs, context as StoryContext<VueRenderer>);
      const element = vnode();

      expect(element.props?.title).toBe('From URL');
      // Slots should be passed as children
      expect(element.children?.default).toBeDefined();
    });
  });

  describe('Reactive args behavior', () => {
    it('should maintain reactivity when args are updated', () => {
      const initialArgs = { count: 0, enabled: false };
      const reactiveArgs = reactive(initialArgs);

      expect(isReactive(reactiveArgs)).toBe(true);

      // Simulate URL args update
      const urlArgs = { count: 5, enabled: true };
      updateArgs(reactiveArgs, urlArgs);

      expect(isReactive(reactiveArgs)).toBe(true);
      expect(reactiveArgs.count).toBe(5);
      expect(reactiveArgs.enabled).toBe(true);
    });

    it('should handle nested objects in args', () => {
      const reactiveArgs = reactive({
        config: { theme: 'light', size: 'medium' },
      });

      const urlArgs = {
        config: { theme: 'dark', size: 'large' },
      };

      updateArgs(reactiveArgs, urlArgs);

      expect(reactiveArgs.config.theme).toBe('dark');
      expect(reactiveArgs.config.size).toBe('large');
    });
  });

  describe('Integration scenario', () => {
    it('should simulate isolation mode with URL args', () => {
      // This test simulates what happens when a story is opened in isolation mode
      // with URL args like ?args=size:large;variant:primary

      const ButtonComponent = {
        name: 'Button',
        props: ['size', 'variant', 'label'],
        template: '<button :class="[size, variant]">{{ label }}</button>',
      };

      // 1. Story context would normally have default args
      const defaultArgs = { size: 'medium', variant: 'secondary', label: 'Button' };

      // 2. URL parser would override with URL args
      const urlArgs = { size: 'large', variant: 'primary', label: 'Button' };

      // 3. Context args should be updated before render
      const context: Partial<StoryContext<VueRenderer>> = {
        id: 'button-story',
        component: ButtonComponent,
        args: urlArgs, // This should contain URL args, not default args
        argTypes: {}, // Add argTypes to avoid undefined error
      };

      // 4. Render function should use the URL args
      const vnode = render(urlArgs, context as StoryContext<VueRenderer>);
      const element = vnode();

      // 5. Component should receive URL args as props
      expect(element.props?.size).toBe('large');
      expect(element.props?.variant).toBe('primary');

      // This ensures the button displays with the correct size from URL,
      // fixing the bug where it would show 'medium' despite URL saying 'large'
    });
  });
});
