import type { Meta, Story } from '../../../csf-types.ts';

import { html } from './base.ts';
import './lit-template-shapes.ts';
import { Card, type CardArgs, Row } from './markup.ts';
import { spreadProps } from './spread.ts';

const meta = {
  title: 'WebComponentsStoryDocs/LitHelperShapes',
  component: 'lit-template-shapes',
} satisfies Meta;

export default meta;

const List = (props: CardArgs) =>
  html`<ul>
    ${Row(props)}${Row({ ...props, label: 'Fixed' })}
  </ul>`;

export const ReExportedHtml: Story = {
  args: { label: 'Alpha' },
  render: (args) => html`<lit-template-shapes label=${args.label}></lit-template-shapes>`,
};

export const HelperCall: Story = {
  args: { label: 'Alpha', count: 2 },
  render: (args) => Card(args),
};

export const HelperDefaults: Story = {
  args: { heading: 'Head' },
  render: (args) => Card({ ...args, count: 5 }, html`<b>${args.heading}</b>`),
};

export const HelperInHtml: Story = {
  args: { label: 'Alpha', count: 2 },
  render: (args) => html`<section>${List(args)}</section>`,
};

export const Csf2Helper = (args: CardArgs) => Card({ ...args, disabled: true });
Csf2Helper.args = { label: 'Alpha' };

export const SpreadDirective: Story = {
  args: { label: 'Alpha', count: 2, disabled: true },
  render: (args) => html`<lit-template-shapes ${spreadProps(args)}></lit-template-shapes>`,
};

export const SpreadNextToAttribute: Story = {
  args: { count: 2 },
  render: ({ heading, ...rest }) =>
    html`<lit-template-shapes label="Written" ${spreadProps(rest)}
      >${heading}</lit-template-shapes
    >`,
};

export const BranchingHelper: Story = {
  args: { label: 'Alpha', disabled: true },
  render: (args) => {
    if (args.disabled) {
      return html`<lit-template-shapes disabled></lit-template-shapes>`;
    }
    return Card(args);
  },
};
