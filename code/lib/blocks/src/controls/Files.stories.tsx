import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { FilesControl } from './Files';

const meta = {
  component: FilesControl,
  tags: ['autodocs'],
  parameters: { withRawArg: 'value', controls: { include: ['value', 'accept'] } },
  argTypes: {
    value: {
      description: 'Selected file',
      control: { type: 'file' },
    },
  },
  args: {
    name: 'files',
    onChange: fn(),
  },
} satisfies Meta<typeof FilesControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Undefined: Story = {
  args: { value: undefined },
};
// for security reasons a file input field cannot have an initial value, so it doesn't make sense to have stories for it

export const AcceptAnything: Story = {
  args: { accept: '*/*' },
};

export const AcceptPDFs: Story = {
  name: 'Accept PDFs',
  args: { accept: '.pdf' },
};

export const Disabled: Story = {
  args: {
    accept: '*/*',
    argType: { control: { readOnly: true } },
  },
};
