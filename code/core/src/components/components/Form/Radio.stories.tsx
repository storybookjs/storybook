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
      <small>Custom:</small>
      <small>Native:</small>

      <small>Checked, focus:</small>
      <Component defaultChecked data-focus name="a" />
      <div>
        <input type="radio" name="e" style={{ margin: 0 }} defaultChecked data-focus />
      </div>

      <small>Checked:</small>
      <Component defaultChecked name="b" />
      <div>
        <input type="radio" name="f" style={{ margin: 0 }} defaultChecked />
      </div>

      <small>Indeterminate:</small>
      <Component name="indeterminate" />
      <div>
        <input type="radio" name="indeterminate3" style={{ margin: 0 }} />
      </div>

      <small>Default:</small>
      <Component name="b" />
      <div>
        <input type="radio" name="f" style={{ margin: 0 }} />
      </div>

      <small>Disabled, checked:</small>
      <Component disabled defaultChecked name="c" />
      <div>
        <input type="radio" name="g" style={{ margin: 0 }} disabled defaultChecked />
      </div>

      <small>Disabled, indeterminate:</small>
      <Component disabled name="indeterminate2" />
      <div>
        <input type="radio" name="indeterminate4" style={{ margin: 0 }} disabled />
      </div>

      <small>Disabled:</small>
      <Component disabled name="c" />
      <div>
        <input type="radio" name="h" style={{ margin: 0 }} disabled />
      </div>
    </div>
  ),
  parameters: {
    pseudo: {
      focus: '[data-focus]',
    },
  },
};
