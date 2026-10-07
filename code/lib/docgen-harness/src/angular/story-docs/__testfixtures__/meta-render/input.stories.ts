import type { Meta, StoryObj } from '../../../csf-types.ts';

import { MetaRenderComponent } from './meta-render.component.ts';

const meta = {
  title: 'StoryDocs/meta-render',
  component: MetaRenderComponent,
  render: (args) => ({
    props: args,
    template: '<sb-meta-render [label]="label"></sb-meta-render>',
  }),
} satisfies Meta<MetaRenderComponent>;

export default meta;

type Story = StoryObj<MetaRenderComponent>;

/** Inherits the meta-level render, so no snippet can be derived. */
export const InheritsMetaRender: Story = {
  args: { label: 'Meta' },
};
