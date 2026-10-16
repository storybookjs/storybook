// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- we can't expect error as it is an error in development but it isn't sandbox
// @ts-ignore only present in sandbox
import preview from '#.storybook/preview';

const meta = preview.meta({
  // @ts-expect-error fix globalThis.__TEMPLATE_COMPONENTS__ type not existing later
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  args: {
    label: 'Hello world!',
  },
});

export const Story = meta.story({});
