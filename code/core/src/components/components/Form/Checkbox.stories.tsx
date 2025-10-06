import type { Meta, StoryObj } from '@storybook/react-vite';

import { Checkbox as Component } from './Checkbox';

const meta = {
  component: Component,
  title: 'Form/Checkbox',
} satisfies Meta<typeof Component>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Checkbox: Story = {
  render: () => (
    <div style={{ display: 'inline-grid', gap: 15, gridTemplateColumns: 'repeat(3, auto)' }}>
      <small></small>
      <small>Custom:</small>
      <small>Native:</small>

      <small>Checked, focus:</small>
      <Component defaultChecked data-focus />
      <div>
        <input type="checkbox" style={{ margin: 0 }} defaultChecked data-focus />
      </div>

      <small>Checked:</small>
      <Component defaultChecked />
      <div>
        <input type="checkbox" style={{ margin: 0 }} defaultChecked />
      </div>

      <small>Indeterminate:</small>
      <Component data-indeterminate />
      <div>
        <input type="checkbox" style={{ margin: 0 }} data-indeterminate />
      </div>

      <small>Default:</small>
      <Component />
      <div>
        <input type="checkbox" style={{ margin: 0 }} />
      </div>

      <small>Disabled, checked:</small>
      <Component disabled defaultChecked />
      <div>
        <input type="checkbox" style={{ margin: 0 }} disabled defaultChecked />
      </div>

      <small>Disabled, indeterminate:</small>
      <Component disabled data-indeterminate />
      <div>
        <input type="checkbox" style={{ margin: 0 }} disabled data-indeterminate />
      </div>

      <small>Disabled:</small>
      <Component disabled />
      <div>
        <input type="checkbox" style={{ margin: 0 }} disabled />
      </div>
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
