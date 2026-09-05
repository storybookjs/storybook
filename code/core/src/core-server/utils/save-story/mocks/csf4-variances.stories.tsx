// @ts-expect-error this is just a mock file
import preview from '#.storybook/preview';

const meta = preview.meta({
  title: 'MyComponent',
  args: {
    initial: 'foo',
  },
});
export const Empty = meta.story({});
export const WithArgs = meta.story({
  args: {
    foo: 'bar',
  },
});
// A spread carries its own args, so saved args have to land after it to take effect
export const SpreadsAnotherStory = meta.story({
  ...WithArgs,
});
