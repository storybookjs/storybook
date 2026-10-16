import { html } from 'lit';

import type { Meta, Story } from '../../csf-types.ts';

import './lit-events.ts';

const meta = {
  title: 'WebComponentsFixtures/LitEvents',
  component: 'lit-events',
  args: { value: 'changed', 'my-change-event': () => {}, 'my-close-event': () => {} },
} satisfies Meta;

export default meta;

export const ArgsDefaultRender: Story = {
  args: { value: 'default event' },
};

export const LitTemplate: Story = {
  render: (args) =>
    html`<lit-events
      value=${args.value}
      @my-change=${args['my-change-event']}
      @my-close=${args['my-close-event']}
    ></lit-events>`,
};

export const DomNode: Story = {
  render: (args) => {
    const el = document.createElement('lit-events');
    el.setAttribute('value', String(args.value));
    el.addEventListener('my-change', args['my-change-event'] as EventListener);
    el.addEventListener('my-close', args['my-close-event'] as EventListener);
    return el;
  },
};
