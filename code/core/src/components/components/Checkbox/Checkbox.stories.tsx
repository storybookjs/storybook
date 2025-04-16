import type { Meta, StoryObj } from '@storybook/react-vite';

import { Checkbox } from './Checkbox';

const meta = {
  component: Checkbox,
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {
  render: () => (
    <div style={{ display: 'inline-grid', gap: 15, gridTemplateColumns: 'repeat(8, auto)' }}>
      <Checkbox checked data-focus />
      <Checkbox checked />
      <Checkbox data-indeterminate />
      <Checkbox />
      <Checkbox disabled checked />
      <Checkbox disabled data-indeterminate />
      <Checkbox disabled />
      <small>(custom)</small>
      <input type="checkbox" style={{ margin: 0 }} checked data-focus />
      <input type="checkbox" style={{ margin: 0 }} checked />
      <input type="checkbox" style={{ margin: 0 }} data-indeterminate />
      <input type="checkbox" style={{ margin: 0 }} />
      <input type="checkbox" style={{ margin: 0 }} disabled checked />
      <input type="checkbox" style={{ margin: 0 }} disabled data-indeterminate />
      <input type="checkbox" style={{ margin: 0 }} disabled />
      <small>(native)</small>
    </div>
  ),
  experimental_afterEach: async ({ canvasElement }) => {
    canvasElement.querySelectorAll<HTMLInputElement>('[data-indeterminate]').forEach((checkbox) => {
      checkbox.indeterminate = true;
    });
  },
  parameters: {
    pseudo: {
      focus: '[data-focus]',
    },
  },
};

export const Default: Story = {};

export const Checked: Story = {
  args: {
    checked: true,
  },
};

export const Indeterminate: Story = {
  experimental_afterEach: async ({ canvasElement }) => {
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
  experimental_afterEach: async ({ canvasElement }) => {
    canvasElement.getElementsByTagName('input')[0].indeterminate = true;
  },
};
