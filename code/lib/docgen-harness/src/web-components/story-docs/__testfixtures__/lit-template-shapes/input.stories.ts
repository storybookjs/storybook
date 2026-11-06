import { html, nothing } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import type { Meta, Story } from '../../../csf-types.ts';

import './lit-template-shapes.ts';

const meta = {
  title: 'WebComponentsStoryDocs/LitTemplateShapes',
  component: 'lit-template-shapes',
} satisfies Meta;

export default meta;

export const Attributes: Story = {
  args: { label: 'Alpha', count: 2, disabled: true },
  render: (args) =>
    html`<lit-template-shapes
      label=${args.label}
      count=${args.count}
      ?disabled=${args.disabled}
    ></lit-template-shapes>`,
};

export const DisabledFalse: Story = {
  args: { label: 'Beta', count: 3, disabled: false },
  render: (args) =>
    html`<lit-template-shapes
      label=${args.label}
      count=${args.count}
      ?disabled=${args.disabled}
    ></lit-template-shapes>`,
};

export const QuotedAndMultiHole: Story = {
  args: { tone: 'warm', size: 'large', label: 'Quoted' },
  render: (args) =>
    html`<lit-template-shapes
      class="card ${args.tone} ${args.size}"
      label="${args.label}"
    ></lit-template-shapes>`,
};

export const PropertyPaired: Story = {
  args: { heading: 'Heading', open: true },
  render: (args) =>
    html`<lit-template-shapes .heading=${args.heading} .open=${args.open}></lit-template-shapes>`,
};

export const PropertyPairedFalse: Story = {
  args: { heading: 'Closed', open: false },
  render: (args) =>
    html`<lit-template-shapes .heading=${args.heading} .open=${args.open}></lit-template-shapes>`,
};

export const PropertyOnly: Story = {
  args: { items: [{ name: 'Alpha' }] },
  render: (args) => html`<lit-template-shapes .items=${args.items}></lit-template-shapes>`,
};

export const Listener: Story = {
  args: { onShapeChange: () => {} },
  render: (args) =>
    html`<lit-template-shapes @shape-change=${args.onShapeChange}></lit-template-shapes>`,
};

export const IfDefined: Story = {
  args: { label: undefined, count: 4 },
  render: (args) =>
    html`<lit-template-shapes
      label=${ifDefined(args.label)}
      count=${ifDefined(args.count)}
    ></lit-template-shapes>`,
};

export const Nothing: Story = {
  args: { label: 'Set', show: false },
  render: (args) =>
    html`<lit-template-shapes label=${args.label ? args.label : nothing}
      >${args.show ? html`<b>shown</b>` : nothing}</lit-template-shapes
    >`,
};

export const Nested: Story = {
  args: { label: 'Nested' },
  render: (args) =>
    html`<lit-template-shapes>${html`<span>${args.label}</span>`}</lit-template-shapes>`,
};

export const ClassMap: Story = {
  args: { active: true },
  render: (args) =>
    html`<lit-template-shapes
      class=${classMap({ active: Boolean(args.active) })}
    ></lit-template-shapes>`,
};

export const UnboundArg: Story = {
  args: { label: 'Bound', count: 5 },
  render: (args) => html`<lit-template-shapes label=${args.label}></lit-template-shapes>`,
};

export const Destructured: Story = {
  args: { label: 'Destructured', count: 6 },
  render: ({ label, count: n }) =>
    html`<lit-template-shapes label=${label} count=${n}></lit-template-shapes>`,
};

export const Aliased: Story = {
  args: { label: 'Aliased', count: 7, heading: 'Head' },
  render: (args) => {
    const { label, count: n } = args;
    const heading = args.heading;
    const tag = html`<b>${label}</b>`;
    return html`<lit-template-shapes label=${label} count=${n} .heading=${heading}
      >${tag}</lit-template-shapes
    >`;
  },
};

export const MemberPath: Story = {
  args: { user: { name: 'Bob', admin: false } },
  render: (args) => {
    const user = args.user as { name: string; admin: boolean };
    return html`<lit-template-shapes label=${user.name}
      >${user.admin ? 'admin' : 'guest'}</lit-template-shapes
    >`;
  },
};

export const NestedListener: Story = {
  args: { onShapeChange: () => {}, onInnerClick: () => {} },
  render: (args) =>
    html`<lit-template-shapes @shape-change=${args.onShapeChange}
      >${html`<button @click=${args.onInnerClick}>Go</button>`}</lit-template-shapes
    >`,
};

export const PrefixedClass: Story = {
  args: { size: 'large' },
  render: (args) => html`<lit-template-shapes class="btn-${args.size}"></lit-template-shapes>`,
};
