import { html } from 'lit';

import type { Meta, Story } from '../../csf-types.ts';

import './lit-basic-attributes.ts';

const meta = {
  title: 'WebComponentsFixtures/LitBasicAttributes',
  component: 'lit-basic-attributes',
  args: { label: 'Open panel', count: 7, disabled: false, isOpen: true },
} satisfies Meta;

export default meta;

export const ArgsDefaultRender: Story = {
  args: { label: 'Default render', count: 3, disabled: true, isOpen: true },
};

export const LitTemplate: Story = {
  render: (args) =>
    html`<lit-basic-attributes
      label=${args.label}
      count=${args.count}
      ?disabled=${args.disabled}
      ?is-open=${args.isOpen}
    ></lit-basic-attributes>`,
};

export const DomNode: Story = {
  render: (args) => {
    const el = document.createElement('lit-basic-attributes');
    el.setAttribute('label', String(args.label));
    el.setAttribute('count', String(args.count));
    if (args.disabled) {
      el.setAttribute('disabled', '');
    }
    if (args.isOpen) {
      el.setAttribute('is-open', '');
    }
    return el;
  },
};
