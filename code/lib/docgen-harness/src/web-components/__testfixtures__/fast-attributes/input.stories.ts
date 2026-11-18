import { html } from 'lit';

import type { Meta, Story } from '../../csf-types.ts';

import './fast-attributes.ts';

const meta = {
  title: 'WebComponentsFixtures/FastAttributes',
  component: 'fast-attributes',
  args: { label: 'Count', size: 'large', disabled: false, maxCount: 5, items: ['a'] },
} satisfies Meta;

export default meta;

export const ArgsDefaultRender: Story = {
  args: { label: 'Default count', maxCount: 2 },
};

export const LitTemplate: Story = {
  render: (args) =>
    html`<fast-attributes
      label=${args.label}
      size=${args.size}
      ?disabled=${args.disabled}
      max-count=${args.maxCount}
      .items=${args.items}
    ></fast-attributes>`,
};

export const DomNode: Story = {
  render: (args) => {
    const el = document.createElement('fast-attributes');
    el.setAttribute('label', String(args.label));
    el.setAttribute('size', String(args.size));
    if (args.disabled) {
      el.setAttribute('disabled', '');
    }
    el.setAttribute('max-count', String(args.maxCount));
    (el as HTMLElement & { items: string[] }).items = args.items as string[];
    return el;
  },
};
