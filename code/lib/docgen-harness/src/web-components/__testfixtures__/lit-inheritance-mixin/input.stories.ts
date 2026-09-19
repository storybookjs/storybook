import { html } from 'lit';

import type { Meta, Story } from '../../csf-types.ts';

import './lit-inheritance-mixin.ts';

const meta = {
  title: 'WebComponentsFixtures/LitInheritanceMixin',
  component: 'lit-inheritance-mixin',
  args: { baseLabel: 'Inherited', mixedActive: true, count: 5 },
} satisfies Meta;

export default meta;

export const ArgsDefaultRender: Story = {
  args: { baseLabel: 'Default base', mixedActive: true, count: 2 },
};

export const LitTemplate: Story = {
  render: (args) =>
    html`<lit-inheritance-mixin
      base-label=${args.baseLabel}
      ?mixed-active=${args.mixedActive}
      count=${args.count}
    ></lit-inheritance-mixin>`,
};

export const DomNode: Story = {
  render: (args) => {
    const el = document.createElement('lit-inheritance-mixin');
    el.setAttribute('base-label', String(args.baseLabel));
    if (args.mixedActive) {
      el.setAttribute('mixed-active', '');
    }
    el.setAttribute('count', String(args.count));
    return el;
  },
};
