import { html } from 'lit';

import type { Meta, Story } from '../../csf-types.ts';

import './lit-property-only.ts';

const meta = {
  title: 'WebComponentsFixtures/LitPropertyOnly',
  component: 'lit-property-only',
  args: {
    label: 'Configured',
    items: [{ name: 'Alpha' }, { name: 'Beta' }],
    config: { dense: true, theme: 'dark' },
  },
} satisfies Meta;

export default meta;

export const ArgsDefaultRender: Story = {
  args: { label: 'Default render' },
};

export const LitTemplate: Story = {
  render: (args) =>
    html`<lit-property-only
      label=${args.label}
      .items=${args.items}
      .config=${args.config}
    ></lit-property-only>`,
};

export const DomNode: Story = {
  render: (args) => {
    const el = document.createElement('lit-property-only') as HTMLElement & {
      config?: unknown;
      items?: unknown;
    };
    el.setAttribute('label', String(args.label));
    el.items = args.items;
    el.config = args.config;
    return el;
  },
};
