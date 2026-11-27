import { html } from 'lit';

import type { Meta, Story } from '../../csf-types.ts';

const meta = {
  title: 'WebComponentsFixtures/StencilProps',
  component: 'stencil-props',
  args: { value: 3, max: 5, variant: 'compact', labelText: 'Rating' },
} satisfies Meta;

export default meta;

export const ArgsDefaultRender: Story = {
  args: { value: 1, variant: 'full', labelText: 'Default rating' },
};

export const LitTemplate: Story = {
  render: (args) =>
    html`<stencil-props
      value=${args.value}
      max=${args.max}
      variant=${args.variant}
      aria-label-text=${args.labelText}
    ></stencil-props>`,
};

export const DomNode: Story = {
  render: (args) => {
    const el = document.createElement('stencil-props');
    el.setAttribute('value', String(args.value));
    el.setAttribute('max', String(args.max));
    el.setAttribute('variant', String(args.variant));
    el.setAttribute('aria-label-text', String(args.labelText));
    return el;
  },
};
