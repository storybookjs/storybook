import { html } from 'lit';

import type { Meta, Story } from '../../csf-types.ts';

import './vanilla-basic.js';

const meta = {
  title: 'WebComponentsFixtures/VanillaBasic',
  component: 'vanilla-basic',
  args: { label: 'Vanilla', count: 4, disabled: true },
} satisfies Meta;

export default meta;

export const ArgsDefaultRender: Story = {
  args: { label: 'Default vanilla', count: 1, disabled: false },
};

export const LitTemplate: Story = {
  render: (args) =>
    html`<vanilla-basic
      label=${args.label}
      count=${args.count}
      ?disabled=${args.disabled}
    ></vanilla-basic>`,
};

export const DomNode: Story = {
  render: (args) => {
    const el = document.createElement('vanilla-basic');
    el.setAttribute('label', String(args.label));
    el.setAttribute('count', String(args.count));
    if (args.disabled) {
      el.setAttribute('disabled', '');
    }
    return el;
  },
};
