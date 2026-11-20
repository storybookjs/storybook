import type { Meta, StoryObj } from '@storybook/react-vite';

import { EmptyExample } from './EmptyExample.tsx';

/** One story on the docs page, one story excluded from it */
const meta = {
  title: 'examples/DocsPage with a hidden story',
  component: EmptyExample,
  parameters: { chromatic: { disableSnapshot: true } },
} satisfies Meta<typeof EmptyExample>;
export default meta;

type Story = StoryObj<typeof meta>;

/** This is the description for the hidden story */
export const Hidden: Story = {
  tags: ['!dev'],
};

/** This is the description for the visible story */
export const Visible: Story = {
  tags: ['autodocs'],
};
