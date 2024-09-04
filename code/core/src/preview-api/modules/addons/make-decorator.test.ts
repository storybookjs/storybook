import { describe, expect, it, vi } from 'vitest';

import type { Addon_StoryContext } from '@storybook/core/types';

import { makeDecorator } from './make-decorator';

// Copy & paste from internal api: client-api/src/client_api
type DecoratorFn = (fn: any, context: Addon_StoryContext) => any;

const defaultDecorateStory = (getStory: any, decorators: DecoratorFn[]) =>
  decorators.reduce(
    (decorated, decorator) => (context: Addon_StoryContext) =>
      decorator(() => decorated(context), context),
    getStory
  );

const baseContext = {
  name: '',
  kind: '',
  parameters: {},
};

describe('makeDecorator', () => {
  it('returns a decorator that passes parameters on the parameters argument', () => {
    const wrapper = vi.fn();
    const decorator = makeDecorator({ wrapper, name: 'test', parameterName: 'test' });
    const story = vi.fn();
    const decoratedStory = defaultDecorateStory(story, [decorator]);

    const context = { kind: '', name: '', parameters: { test: 'test-val' } };
    decoratedStory(context);

    expect(wrapper).toHaveBeenCalledWith(expect.any(Function), context, { parameters: 'test-val' });
  });

  it('passes options added at decoration time', () => {
    const wrapper = vi.fn();
    const decorator = makeDecorator({ wrapper, name: 'test', parameterName: 'test' });
    const story = vi.fn();
    const options = 'test-val';
    const decoratedStory = defaultDecorateStory(story, [decorator(options)]);

    const context = { ...baseContext };
    decoratedStory(context);

    expect(wrapper).toHaveBeenCalledWith(expect.any(Function), context, { options: 'test-val' });
  });

  it('passes object options added at decoration time', () => {
    const wrapper = vi.fn();
    const decorator = makeDecorator({ wrapper, name: 'test', parameterName: 'test' });
    const story = vi.fn();
    const options = { test: 'val' };
    const decoratedStory = defaultDecorateStory(story, [decorator(options)]);

    const context = { ...baseContext };
    decoratedStory(context);

    expect(wrapper).toHaveBeenCalledWith(expect.any(Function), context, {
      options: { test: 'val' },
    });
  });

  it('passes multiple options added at decoration time', () => {
    const wrapper = vi.fn();
    const decorator = makeDecorator({ wrapper, name: 'test', parameterName: 'test' });
    const story = vi.fn();
    const options = ['test-val', 'test-val2'];
    const decoratedStory = defaultDecorateStory(story, [decorator(...options)]);

    const context = { ...baseContext };
    decoratedStory(context);

    expect(wrapper).toHaveBeenCalledWith(expect.any(Function), context, {
      options: ['test-val', 'test-val2'],
    });
  });

  it('passes multiple options including objects added at decoration time', () => {
    const wrapper = vi.fn();
    const decorator = makeDecorator({ wrapper, name: 'test', parameterName: 'test' });
    const story = vi.fn();
    const options = ['test-val', 'test-val2', { test: 'val' }];
    const decoratedStory = defaultDecorateStory(story, [decorator(...options)]);

    const context = { ...baseContext };
    decoratedStory(context);

    expect(wrapper).toHaveBeenCalledWith(expect.any(Function), context, {
      options: ['test-val', 'test-val2', { test: 'val' }],
    });
  });

  it('passes both options *and* parameters at the same time', () => {
    const wrapper = vi.fn();
    const decorator = makeDecorator({ wrapper, name: 'test', parameterName: 'test' });
    const story = vi.fn();
    const options = 'test-val';
    const decoratedStory = defaultDecorateStory(story, [decorator(options)]);

    const context = { ...baseContext, parameters: { test: 'test-val' } };
    decoratedStory(context);

    expect(wrapper).toHaveBeenCalledWith(expect.any(Function), context, {
      options: 'test-val',
      parameters: 'test-val',
    });
  });

  it('passes nothing if neither are supplied', () => {
    const wrapper = vi.fn();
    const decorator = makeDecorator({ wrapper, name: 'test', parameterName: 'test' });
    const story = vi.fn();
    const decoratedStory = defaultDecorateStory(story, [decorator]);

    const context = { ...baseContext };
    decoratedStory(context);

    expect(wrapper).toHaveBeenCalledWith(expect.any(Function), context, {});
  });

  it('calls the story directly if neither options or parameters are supplied and skipIfNoParametersOrOptions is true', () => {
    const wrapper = vi.fn();
    const decorator = makeDecorator({
      wrapper,
      name: 'test',
      parameterName: 'test',
      skipIfNoParametersOrOptions: true,
    });
    const story = vi.fn();
    const decoratedStory = defaultDecorateStory(story, [decorator]);

    const context = { ...baseContext };
    decoratedStory(context);

    expect(wrapper).not.toHaveBeenCalled();
    expect(story).toHaveBeenCalled();
  });

  it('calls the story directly if the disable parameter is passed to the decorator', () => {
    const wrapper = vi.fn();
    const decorator = makeDecorator({
      wrapper,
      name: 'test',
      parameterName: 'test',
      skipIfNoParametersOrOptions: true,
    });
    const story = vi.fn();
    const decoratedStory = defaultDecorateStory(story, [decorator]);

    const context = { ...baseContext, parameters: { test: { disable: true } } };
    decoratedStory(context);

    expect(wrapper).not.toHaveBeenCalled();
    expect(story).toHaveBeenCalled();
  });

  it('throws if options are added at storytime, if not allowed', () => {
    const wrapper = vi.fn();
    const decorator = makeDecorator({
      wrapper,
      name: 'test',
      parameterName: 'test',
    });
    const options = 'test-val';
    const story = vi.fn();
    expect(() => decorator(options)(story)).toThrow(/not allowed/);
  });
});
