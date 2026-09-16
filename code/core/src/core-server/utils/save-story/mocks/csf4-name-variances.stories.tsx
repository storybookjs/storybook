// @ts-expect-error this is just a mock file
import preview from '#.storybook/preview';

const meta = preview.meta({
  title: 'MyComponent',
});
export const WithName = meta.story({
  name: 'Custom Display Name',
  args: {
    foo: 'bar',
  },
});
