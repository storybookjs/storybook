import { html } from 'lit';

import './demo-wc-card';

export default {
  component: 'demo-wc-card',
  render: ({ backSide, header, rows, prefix }) => html`
    <demo-wc-card .backSide="${backSide}" .header="${header}" .rows="${rows}"
      ><span slot="prefix">${prefix}</span>A simple card</demo-wc-card
    >
  `,
};

export const Front = {
  args: { backSide: false, header: undefined, rows: [] },
};

export const Back = {
  args: { backSide: true, header: undefined, rows: [] },
};

export const Prefix = {
  args: { backSide: false, prefix: 'prefix:', header: 'my header', rows: [] },
};
