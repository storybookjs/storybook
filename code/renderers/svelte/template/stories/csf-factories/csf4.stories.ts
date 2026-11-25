import preview from '#.storybook/preview';

import { expect } from 'storybook/test';

const meta = preview.meta({
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  args: { label: 'Hello world!' },
});

export const Primary = meta.story({
  args: { primary: true },
  play: async ({ args, canvas }) => {
    await expect(args).toMatchObject({ label: 'Hello world!', primary: true });
    await expect(canvas.getByRole('button')).toHaveTextContent('Hello world!');
  },
});
