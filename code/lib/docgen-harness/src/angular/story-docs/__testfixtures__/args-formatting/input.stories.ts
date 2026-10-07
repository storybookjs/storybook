import type { Meta, StoryObj } from '../../../csf-types.ts';

import { ArgsFormattingComponent, ButtonKind } from './args-formatting.component.ts';

const meta = {
  title: 'StoryDocs/args-formatting',
  component: ArgsFormattingComponent,
} satisfies Meta<ArgsFormattingComponent>;

export default meta;

type Story = StoryObj<ArgsFormattingComponent>;

export const EveryValueShape: Story = {
  args: {
    label: undefined,
    kind: ButtonKind.Secondary,
    offset: -4,
    data: { id: 7, nested: { deep: true } },
    tags: ['a', 'b'],
    greeting: `hello`,
    formatter: (value) => value.replace('"', "'"),
  },
};
