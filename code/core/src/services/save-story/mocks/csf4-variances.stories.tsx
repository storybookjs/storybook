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
export const Typed = meta.type<{ args: { icon: string } }>().story({
  args: {
    icon: 'star',
  },
});
