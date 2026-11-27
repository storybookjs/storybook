import { html } from 'lit';

import type { Meta, Story } from '../../../csf-types.ts';

import './meta-render.ts';

const meta = {
  title: 'WebComponentsStoryDocs/MetaRender',
  component: 'meta-render',
  render: (args) => html`<meta-render label=${args.label}></meta-render>`,
} satisfies Meta;

export default meta;

export const FromMeta: Story = {
  args: { label: 'from-meta' },
};

export const Override: Story = {
  args: { label: 'override' },
  render: (args) => html`<meta-render label=${args.label} class="override"></meta-render>`,
};

export const Csf2Function = (args: { label: string }) =>
  html`<meta-render label=${args.label}></meta-render>`;
Csf2Function.args = { label: 'csf2' };

export const DomOverride: Story = {
  args: { label: 'dom' },
  render: () => document.createElement('meta-render'),
};
