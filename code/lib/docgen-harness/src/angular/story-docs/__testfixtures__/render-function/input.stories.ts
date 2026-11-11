import type { Meta, StoryObj } from '../../../csf-types.ts';

import { RenderFunctionComponent } from './render-function.component.ts';

const meta = {
  title: 'StoryDocs/render-function',
  component: RenderFunctionComponent,
} satisfies Meta<RenderFunctionComponent>;

export default meta;

type Story = StoryObj<RenderFunctionComponent>;

/** Renders a hand-written template. */
export const CustomRender: Story = {
  args: { label: 'Render' },
  render: (args) => ({
    props: args,
    template: '<sb-render-function [label]="label"></sb-render-function>',
  }),
};

export const NoRender: Story = {
  args: { label: 'Plain' },
};
