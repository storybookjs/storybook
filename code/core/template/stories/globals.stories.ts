import { global as globalThis } from '@storybook/global';
import type { PartialStoryFn, PlayFunctionContext, StoryContext } from '@storybook/core/types';
import { within, expect } from '@storybook/test';

export default {
  component: globalThis.Components.Pre,
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
};
