import type { Meta, StoryObj } from '@storybook/react-vite';

import { Checkbox } from './Checkbox';

const meta = {
  component: Checkbox,
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 10 }}>
      <Checkbox checked />
      <Checkbox data-indeterminate />
      <Checkbox />
      <Checkbox disabled checked />
      <Checkbox disabled data-indeterminate />
      <Checkbox disabled />
    </div>
  ),
  play: async ({ canvasElement }) => {
    canvasElement.querySelectorAll<HTMLInputElement>('[data-indeterminate]').forEach((checkbox) => {
      checkbox.indeterminate = true;
    });
  },
};

export const Default: Story = {};

export const Checked: Story = {
  args: {
    checked: true,
  },
};

export const Indeterminate: Story = {
  play: async ({ canvasElement }) => {
    canvasElement.getElementsByTagName('input')[0].indeterminate = true;
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const DisabledChecked: Story = {
  args: {
    checked: true,
    disabled: true,
  },
};

export const DisabledIndeterminate: Story = {
  args: {
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    canvasElement.getElementsByTagName('input')[0].indeterminate = true;
  },
};
