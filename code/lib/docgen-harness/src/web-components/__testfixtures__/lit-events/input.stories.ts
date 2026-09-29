import { html } from 'lit';

import type { Meta, Story } from '../../csf-types.ts';

import './lit-events.ts';

const meta = {
  title: 'WebComponentsFixtures/LitEvents',
  component: 'lit-events',
  args: { value: 'changed', onMyChange: () => {}, onMyClose: () => {} },
} satisfies Meta;

export default meta;

export const ArgsDefaultRender: Story = {
  args: { value: 'default event' },
};

export const LitTemplate: Story = {
  render: (args) =>
    html`<lit-events
      value=${args.value}
      @my-change=${args.onMyChange}
      @my-close=${args.onMyClose}
    ></lit-events>`,
};

export const DomNode: Story = {
  render: (args) => {
    const el = document.createElement('lit-events');
    el.setAttribute('value', String(args.value));
    el.addEventListener('my-change', args.onMyChange as EventListener);
    el.addEventListener('my-close', args.onMyClose as EventListener);
    return el;
  },
};
