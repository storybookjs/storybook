import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  title: 'examples/Button with Meta Description as Parameter',
  component: Button,
  argTypes: {
    backgroundColor: { control: 'color' },
  },
  globals: { sb_theme: 'light' },
  parameters: {
    docs: {
      description: {
        component: `
These are the stories for the Button component

_this description was written as a string in \`parameters.docs.description.component\`_
   `,
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithMetaDescriptionAsParamater: Story = {
  args: {
    primary: true,
    label: 'Button',
  },
};
