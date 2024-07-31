import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  title: 'examples/Button with Meta Subtitle in docs.subtitle',
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  parameters: {
    // Stop *this* story from being stacked in Chromatic
    theme: 'default',
    docs: {
      subtitle: 'This subtitle is set in parameters.docs.subtitle',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithMetaSubtitleInDocsSubtitle: Story = {
  args: {
    primary: true,
    label: 'Button',
  },
};
