import { html } from 'lit';

import type { Meta, Story } from '../../csf-types.ts';

import './index.js';

const meta = {
  title: 'WebComponentsFixtures/DemoWcCard',
  component: 'demo-wc-card',
  args: { backSide: false, header: undefined, rows: [] },
  render: ({ backSide, header, rows, prefix }) => html`
    <demo-wc-card .backSide=${backSide} .header=${header} .rows=${rows}
      ><span slot="prefix">${prefix}</span>A simple card</demo-wc-card
    >
  `,
} satisfies Meta;

export default meta;

export const Front: Story = {
  args: { backSide: false, header: undefined, rows: [] },
};

export const Back: Story = {
  args: { backSide: true, header: undefined, rows: [] },
};

export const Prefix: Story = {
  args: { backSide: false, prefix: 'prefix:', header: 'my header', rows: [] },
};
