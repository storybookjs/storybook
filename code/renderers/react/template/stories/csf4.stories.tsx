// @ts-expect-error this will be part of the package.json of the sandbox
import preview from '#.storybook/preview';

const meta = preview.meta({
  // @ts-expect-error fix globalThis.__TEMPLATE_COMPONENTS__ type not existing later
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  args: {
    label: 'Hello world!',
  },
});

export const Story = meta.story({});
