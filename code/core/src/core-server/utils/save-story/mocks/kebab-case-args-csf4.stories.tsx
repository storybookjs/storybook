// @ts-expect-error this is just a mock file
import preview from '#.storybook/preview';

const meta = preview.meta({
  title: 'MyComponent',
});

export const QuotedKebabArg = meta.story({
  args: {
    'data-testid': 'before',
  },
});
export const NestedCollision = meta.story({
  args: {
    nested: {
      'aria-label': 'inner',
    },
  },
});
