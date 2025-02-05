// @ts-expect-error this will be part of the package.json of the sandbox
import preview from '#.storybook/preview';

const meta = preview.meta({
  component: globalThis.Components.Button,
  args: {
    label: 'Hello world!',
  },
});

export const Story = meta.story({});
