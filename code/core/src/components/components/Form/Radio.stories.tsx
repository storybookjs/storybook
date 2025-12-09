import type { Meta, StoryObj } from '@storybook/react-vite';

import { Radio as Component } from './Radio';

const meta = {
  component: Component,
  title: 'Form/Radio',
} satisfies Meta<typeof Component>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Radio: Story = {
  render: () => (
    <div style={{ display: 'inline-grid', gap: 15, gridTemplateColumns: 'repeat(3, auto)' }}>
      <small></small>
      <small id="col-custom">Custom:</small>
      <small id="col-native">Native:</small>

      <small id="row-focus">Checked, focus:</small>
      <Component aria-labelledby="col-custom row-focus" defaultChecked data-focus name="a" />
      <div>
        <input
          aria-labelledby="col-native row-focus"
          type="radio"
          name="e"
          style={{ margin: 0 }}
          defaultChecked
          data-focus
        />
      </div>

      <small id="row-checked">Checked:</small>
      <Component aria-labelledby="col-custom row-checked" defaultChecked name="b" />
      <div>
        <input
          aria-labelledby="col-native row-checked"
          type="radio"
          name="f"
          style={{ margin: 0 }}
          defaultChecked
        />
      </div>

      <small id="row-indeterminate">Indeterminate:</small>
      <Component aria-labelledby="col-custom row-indeterminate" name="indeterminate" />
      <div>
        <input
          aria-labelledby="col-native row-indeterminate"
          type="radio"
          name="indeterminate3"
          style={{ margin: 0 }}
        />
      </div>

      <small id="row-default">Default:</small>
      <Component aria-labelledby="col-custom row-default" name="b" />
      <div>
        <input
          aria-labelledby="col-native row-default"
          type="radio"
          name="f"
          style={{ margin: 0 }}
        />
      </div>

      <small id="row-disabled-checked">Disabled, checked:</small>
      <Component
        aria-labelledby="col-custom row-disabled-checked"
        disabled
        defaultChecked
        name="c"
      />
      <div>
        <input
          aria-labelledby="col-native row-disabled-checked"
          type="radio"
          name="g"
          style={{ margin: 0 }}
          disabled
          defaultChecked
        />
      </div>

      <small id="row-disabled-indeterminate">Disabled, indeterminate:</small>
      <Component
        aria-labelledby="col-custom row-disabled-indeterminate"
        disabled
        name="indeterminate2"
      />
      <div>
        <input
          aria-labelledby="col-native row-disabled-indeterminate"
          type="radio"
          name="indeterminate4"
          style={{ margin: 0 }}
          disabled
        />
      </div>

      <small id="row-disabled">Disabled:</small>
      <Component aria-labelledby="col-custom row-disabled" disabled name="c" />
      <div>
        <input
          aria-labelledby="col-native row-disabled"
          type="radio"
          name="h"
          style={{ margin: 0 }}
          disabled
        />
      </div>
    </div>
  ),
  parameters: {
    pseudo: {
      focus: '[data-focus]',
    },
  },
};
