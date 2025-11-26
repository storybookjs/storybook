import type { Meta, StoryObj } from '@storybook/vue3';

import { h } from 'vue';

import SourceCode from './SourceCode.vue';

const meta: Meta<typeof SourceCode> = {
  component: SourceCode,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SourceCode>;

export const Default = {
  args: {
    foo: 'Example string',
    bar: 42,
    array: ['A', 'B', 'C'],
    object: {
      a: 'Test A',
      b: 42,
    },
    modelValue: 'Model value',
    default: 'Default slot content',
    namedSlot: ({ foo }) => [
      'Plain text',
      h('div', { style: 'color:red' }, ['Div child', h('span', foo)]),
    ],
  },
} satisfies Story;
