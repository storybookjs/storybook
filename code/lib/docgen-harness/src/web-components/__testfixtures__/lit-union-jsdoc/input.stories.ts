import { html } from 'lit';

import type { Meta, Story } from '../../csf-types.ts';

import './lit-union-jsdoc.ts';

const meta = {
  title: 'WebComponentsFixtures/LitUnionJsdoc',
  component: 'lit-union-jsdoc',
  args: { variant: 'secondary', oldLabel: 'Old', label: 'Current' },
} satisfies Meta;

export default meta;

export const ArgsDefaultRender: Story = {
  args: { variant: 'ghost', oldLabel: 'Legacy', label: 'Default render' },
};

export const LitTemplate: Story = {
  render: (args) =>
    html`<lit-union-jsdoc
      variant=${args.variant}
      old-label=${args.oldLabel}
      label=${args.label}
    ></lit-union-jsdoc>`,
};

export const DomNode: Story = {
  render: (args) => {
    const el = document.createElement('lit-union-jsdoc');
    el.setAttribute('variant', String(args.variant));
    el.setAttribute('old-label', String(args.oldLabel));
    el.setAttribute('label', String(args.label));
    return el;
  },
};
