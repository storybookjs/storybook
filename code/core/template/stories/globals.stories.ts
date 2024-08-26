import type { PartialStoryFn, PlayFunctionContext, StoryContext } from '@storybook/core/types';
import { global as globalThis } from '@storybook/global';
import { expect, within } from '@storybook/test';

export default {
  component: globalThis.Components.Pre,
  tags: ['autodocs'],
  globals: {
    baz: 'bazComponentValue',
  },
};

export const Inheritance = {
  // Compose all the globals into `object`, so the pre component only needs a single prop
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) =>
      storyFn({ args: { object: context.globals } }),
  ],
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    await expect(JSON.parse(within(canvasElement).getByTestId('pre').innerText)).toMatchObject({
      foo: 'fooValue',
      bar: 'barDefaultValue',
      baz: 'bazComponentValue',
    });
  },
};

export const Events = {
  parameters: { chromatic: { disableSnapshot: true } },
  // Just pass the "foo" global to the pre
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) =>
      storyFn({ args: { text: context.globals.foo } }),
  ],
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;
    await channel.emit('updateGlobals', { globals: { foo: 'fooValue' } });
    await within(canvasElement).findByText('fooValue');

    await channel.emit('updateGlobals', { globals: { foo: 'updated' } });
    await within(canvasElement).findByText('updated');

    // Reset it back to the original value just to avoid polluting the URL
    await channel.emit('updateGlobals', { globals: { foo: 'fooValue' } });
    await within(canvasElement).findByText('fooValue');
  },
  tags: ['!vitest'],
};

export const Overrides1 = {
  // Compose all the globals into `object`, so the pre component only needs a single prop
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) =>
      storyFn({ args: { object: context.globals } }),
  ],
  globals: {
    foo: 'fooOverridden1',
    baz: 'bazOverridden1',
  },
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    await expect(JSON.parse(within(canvasElement).getByTestId('pre').innerText)).toMatchObject({
      foo: 'fooOverridden1',
      bar: 'barDefaultValue',
      baz: 'bazOverridden1',
    });
  },
};

export const Overrides2 = {
  // Compose all the globals into `object`, so the pre component only needs a single prop
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) =>
      storyFn({ args: { object: context.globals } }),
  ],
  globals: {
    foo: 'fooOverridden2',
    baz: 'bazOverridden2',
  },
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    await expect(JSON.parse(within(canvasElement).getByTestId('pre').innerText)).toMatchObject({
      foo: 'fooOverridden2',
      bar: 'barDefaultValue',
      baz: 'bazOverridden2',
    });
  },
};
