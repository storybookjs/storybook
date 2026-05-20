import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { DecoratorFunction, LegacyStoryFn, StoryContext } from 'storybook/internal/types';

import { applyDecorators } from './applyDecorators.ts';
import type { ReactRenderer } from './types.ts';

const makeContext = (overrides: Partial<StoryContext<ReactRenderer>> = {}): StoryContext<ReactRenderer> =>
  ({
    args: {},
    argTypes: {},
    globals: {},
    hooks: { current: null },
    parameters: {},
    initialArgs: {},
    componentId: 'test',
    title: 'Test',
    kind: 'Test',
    id: 'test--story',
    name: 'Story',
    story: 'Story',
    tags: [],
    abortSignal: new AbortController().signal,
    canvasElement: document.createElement('div'),
    ...overrides,
  } as unknown as StoryContext<ReactRenderer>);

describe('applyDecorators (React renderer)', () => {
  it('renders the story when no decorators are provided', () => {
    const storyFn: LegacyStoryFn<ReactRenderer> = () =>
      React.createElement('div', null, 'hello');
    const decorated = applyDecorators(storyFn, []);
    const result = decorated(makeContext());
    expect(result).toBeDefined();
  });

  it('passes the context through to the story function', () => {
    const storyFn = vi.fn(() => React.createElement('div')) as unknown as LegacyStoryFn<ReactRenderer>;
    const decorated = applyDecorators(storyFn, []);
    decorated(makeContext({ id: 'custom--story' }));
    expect(storyFn).toHaveBeenCalledWith(expect.objectContaining({ id: 'custom--story' }));
  });

  it('applies a single decorator that wraps the story', () => {
    const storyFn: LegacyStoryFn<ReactRenderer> = () =>
      React.createElement('span', null, 'inner');
    const wrapper: DecoratorFunction<ReactRenderer> = (story) =>
      React.createElement('div', { 'data-wrapped': 'true' }, story());
    const decorated = applyDecorators(storyFn, [wrapper]);
    const result = decorated(makeContext()) as React.ReactElement<{ 'data-wrapped': string }>;
    expect(result.props['data-wrapped']).toBe('true');
  });

  it('applies multiple decorators in the correct nested order', () => {
    const order: string[] = [];
    const storyFn: LegacyStoryFn<ReactRenderer> = () => {
      order.push('story');
      return React.createElement('span');
    };
    const outer: DecoratorFunction<ReactRenderer> = (story) => { order.push('outer'); return story(); };
    const inner: DecoratorFunction<ReactRenderer> = (story) => { order.push('inner'); return story(); };
    const decorated = applyDecorators(storyFn, [outer, inner]);
    decorated(makeContext());
    expect(order).toEqual(['outer', 'inner', 'story']);
  });

  it('returns a function so the result can be invoked later', () => {
    const storyFn: LegacyStoryFn<ReactRenderer> = () => React.createElement('div');
    const decorated = applyDecorators(storyFn, []);
    expect(typeof decorated).toBe('function');
  });
});