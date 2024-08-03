import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  title: 'examples/Button with Meta Subtitle in componentSubtitle',
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  globals: { sb_theme: 'light' },
  parameters: {
    // this is to test the deprecated features of the Subtitle block
    componentSubtitle: 'This subtitle is set in parameters.componentSubtitle',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithMetaSubtitleInComponentSubtitle: Story = {
  args: {
    primary: true,
    label: 'Button',
  },
};
