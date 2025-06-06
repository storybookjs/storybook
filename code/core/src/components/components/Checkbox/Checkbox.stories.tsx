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
      <Checkbox defaultChecked data-focus />
      <Checkbox defaultChecked />
      <Checkbox data-indeterminate />
      <Checkbox />
      <Checkbox disabled defaultChecked />
      <Checkbox disabled data-indeterminate />
      <Checkbox disabled />
      <small>(custom)</small>
      <input type="checkbox" style={{ margin: 0 }} defaultChecked data-focus />
      <input type="checkbox" style={{ margin: 0 }} defaultChecked />
      <input type="checkbox" style={{ margin: 0 }} data-indeterminate />
      <input type="checkbox" style={{ margin: 0 }} />
      <input type="checkbox" style={{ margin: 0 }} disabled defaultChecked />
      <input type="checkbox" style={{ margin: 0 }} disabled data-indeterminate />
      <input type="checkbox" style={{ margin: 0 }} disabled />
      <small>(native)</small>
    </div>
  ),
  afterEach: async ({ canvasElement }) => {
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
    defaultChecked: true,
  },
};

export const Indeterminate: Story = {
  afterEach: async ({ canvasElement }) => {
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
    defaultChecked: true,
    disabled: true,
  },
};

export const DisabledIndeterminate: Story = {
  args: {
    disabled: true,
  },
  afterEach: async ({ canvasElement }) => {
    canvasElement.getElementsByTagName('input')[0].indeterminate = true;
  },
};
