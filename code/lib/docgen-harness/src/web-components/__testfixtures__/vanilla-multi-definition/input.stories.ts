import { html } from 'lit';

import type { Meta, Story } from '../../csf-types.ts';

import './vanilla-multi-definition.js';

const meta = {
  title: 'WebComponentsFixtures/VanillaMultiDefinition',
  component: 'multi-beta',
  args: { betaLabel: 'Beta' },
} satisfies Meta;

export default meta;

export const ArgsDefaultRender: Story = {
  args: { betaLabel: 'Default beta' },
};

export const LitTemplate: Story = {
  render: (args) => html`<multi-beta beta-label=${args.betaLabel}></multi-beta>`,
};

export const DomNode: Story = {
  render: (args) => {
    const el = document.createElement('multi-beta');
    el.setAttribute('beta-label', String(args.betaLabel));
    return el;
  },
};
