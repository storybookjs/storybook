import type { Meta, StoryObj } from '../../../csf-types.ts';

import { SHARED_CONTROL, shout } from './helpers.ts';
import { LiveArgsComponent } from './live-args.component.ts';

// Arg values the live snippet has to bind the way the renderer does, or leave to the static snippet.
const meta = {
  title: 'StoryDocs/live-args',
  component: LiveArgsComponent,
} satisfies Meta<LiveArgsComponent>;

export default meta;

type Story = StoryObj<LiveArgsComponent>;

export const NullLabel: Story = {
  args: { label: null },
};

export const ImportedFormatter: Story = {
  args: { label: 'Go', formatter: shout },
};

export const ImportedControl: Story = {
  args: { control: SHARED_CONTROL },
};

export const OwnMarkupFunction: Story = {
  args: { label: 'Save', formatter: (value) => value.trim() },
  render: (args) => ({
    props: args,
    template: `<sb-live-args [label]="label" [formatter]="formatter"></sb-live-args>`,
  }),
};

export const ComputedProps: Story = {
  args: { label: 'Go' },
  render: (args) => ({
    props: { describe: () => args.label || 'none' },
    template: `<sb-live-args [label]="describe()"></sb-live-args>`,
  }),
};
