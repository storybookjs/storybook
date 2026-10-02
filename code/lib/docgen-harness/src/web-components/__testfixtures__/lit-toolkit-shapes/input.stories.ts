import { html } from 'lit';

import type { Meta, Story } from '../../csf-types.ts';

import './lit-toolkit-shapes.ts';

const meta = {
  title: 'WebComponentsFixtures/LitToolkitShapes',
  component: 'lit-toolkit-shapes',
  args: { size: 'large', level: 2, tags: ['b'], label: 'Shaped', onToolkitResize: () => {} },
} satisfies Meta;

export default meta;

export const ArgsDefaultRender: Story = {
  args: { size: 'small', level: 3, label: 'Default render' },
};

export const LitTemplate: Story = {
  render: (args) =>
    html`<lit-toolkit-shapes
      size=${args.size}
      level=${args.level}
      .tags=${args.tags}
      label=${args.label}
      @toolkit-resize=${args.onToolkitResize}
    ></lit-toolkit-shapes>`,
};

export const DomNode: Story = {
  render: (args) => {
    const el = document.createElement('lit-toolkit-shapes');
    el.setAttribute('size', String(args.size));
    el.setAttribute('level', String(args.level));
    el.setAttribute('label', String(args.label));
    (el as HTMLElement & { tags: string[] }).tags = args.tags as string[];
    el.addEventListener('toolkit-resize', args.onToolkitResize as EventListener);
    return el;
  },
};
