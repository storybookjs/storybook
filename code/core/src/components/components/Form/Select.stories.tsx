import type { Meta, StoryObj } from '@storybook/react-vite';

import { action } from 'storybook/actions';

import { Select as Component } from './Select.tsx';

const meta = {
  title: 'Form/Select',
  component: Component,
} satisfies Meta<typeof Component>;

type Story = StoryObj<typeof meta>;

export default meta;

export const Select: Story = {
  render: (args) => (
    <Component aria-label="Fruit" onChange={action('onChange')} defaultValue="" {...args}>
      <option value="" hidden disabled>
        Select a Fruit
      </option>
      <option value="apple">Apple</option>
      <option value="banana">Banana</option>
      <option value="blueberry">Blueberry</option>
      <option value="grapes">Grapes</option>
      <option value="pineapple">Pineapple</option>
    </Component>
  ),
};

// Logical padding keeps the dropdown chevron clear of the text under `dir="rtl"`;
// the old physical `padding-right` reserved space on the wrong side and the value
// overlapped the chevron (#35481).
export const Rtl: Story = {
  ...Select,
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
};
