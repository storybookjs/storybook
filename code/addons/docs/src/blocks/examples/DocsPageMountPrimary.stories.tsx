import type { Meta, StoryObj } from '@storybook/react-vite';

import { EmptyExample } from './EmptyExample.tsx';

/** The primary story uses mount, so the Stories block leaves it out */
const meta = {
  title: 'examples/DocsPage with a mount primary story',
  component: EmptyExample,
  parameters: { chromatic: { disableSnapshot: true } },
  tags: ['autodocs'],
} satisfies Meta<typeof EmptyExample>;
export default meta;

type Story = StoryObj<typeof meta>;

/** This is the description for the mount story */
export const WithMount: Story = {
  play: async ({ mount }) => {
    await mount();
  },
};

/** This is the description for the other story */
export const Other: Story = {};
