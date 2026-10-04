import { html } from 'lit';

import type { Meta, Story } from '../../csf-types.ts';

import './lit-slots-and-css.ts';

const meta = {
  title: 'WebComponentsFixtures/LitSlotsAndCss',
  component: 'lit-slots-and-css',
  args: { heading: 'Projected' },
} satisfies Meta;

export default meta;

export const ArgsDefaultRender: Story = {
  args: { heading: 'Default render' },
};

export const LitTemplate: Story = {
  render: (args) =>
    html`<lit-slots-and-css heading=${args.heading}>
      <p>Default slot content</p>
      <button slot="actions">Confirm</button>
    </lit-slots-and-css>`,
};

export const DomNode: Story = {
  render: (args) => {
    const el = document.createElement('lit-slots-and-css');
    el.setAttribute('heading', String(args.heading));
    const body = document.createElement('p');
    body.textContent = 'Default slot content';
    const action = document.createElement('button');
    action.slot = 'actions';
    action.textContent = 'Confirm';
    el.append(body, action);
    return el;
  },
};
