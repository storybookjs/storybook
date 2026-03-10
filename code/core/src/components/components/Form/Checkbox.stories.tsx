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
      <small id="col-custom">Custom:</small>
      <small id="col-native">Native:</small>

      <small id="row-focus">Checked, focus:</small>
      <Component aria-labelledby="col-custom row-focus" defaultChecked data-focus />
      <div>
        <input
          aria-labelledby="col-native row-focus"
          type="checkbox"
          style={{ margin: 0 }}
          defaultChecked
          data-focus
        />
      </div>

      <small id="row-checked">Checked:</small>
      <Component aria-labelledby="col-custom row-checked" defaultChecked />
      <div>
        <input
          aria-labelledby="col-native row-checked"
          type="checkbox"
          style={{ margin: 0 }}
          defaultChecked
        />
      </div>

      <small id="row-indeterminate">Indeterminate:</small>
      <Component aria-labelledby="col-custom row-indeterminate" data-indeterminate />
      <div>
        <input
          aria-labelledby="col-native row-indeterminate"
          type="checkbox"
          style={{ margin: 0 }}
          data-indeterminate
        />
      </div>

      <small id="row-default">Default:</small>
      <Component aria-labelledby="col-custom row-default" />
      <div>
        <input aria-labelledby="col-native row-default" type="checkbox" style={{ margin: 0 }} />
      </div>

      <small id="row-disabled-checked">Disabled, checked:</small>
      <Component aria-labelledby="col-custom row-disabled-checked" disabled defaultChecked />
      <div>
        <input
          aria-labelledby="col-native row-disabled-checked"
          type="checkbox"
          style={{ margin: 0 }}
          disabled
          defaultChecked
        />
      </div>

      <small id="row-disabled-indeterminate">Disabled, indeterminate:</small>
      <Component
        aria-labelledby="col-custom row-disabled-indeterminate"
        disabled
        data-indeterminate
      />
      <div>
        <input
          aria-labelledby="col-native row-disabled-indeterminate"
          type="checkbox"
          style={{ margin: 0 }}
          disabled
          data-indeterminate
        />
      </div>

      <small id="row-disabled">Disabled:</small>
      <Component aria-labelledby="col-custom row-disabled" disabled />
      <div>
        <input
          aria-labelledby="col-native row-disabled"
          type="checkbox"
          style={{ margin: 0 }}
          disabled
        />
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
