import type { Meta, StoryObj } from '@storybook/vue3';

import NamedTypeDetails from './NamedTypeDetails.vue';
import { Color, Level } from './named-types.ts';

const meta = {
  title: 'VueFixtures/NamedTypeDetails',
  component: NamedTypeDetails,
} satisfies Meta<typeof NamedTypeDetails>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: {
    user: { name: 'Ada', age: 36 },
    color: Color.Red,
    level: Level.High,
    scalarAlias: 'abc-123',
    shapes: 'circle',
    cyclic: { peer: { peer: null } },
    big: {},
    builtin: new Date(0),
    inlined: { foo: 'foo', bar: 1 },
    namespaced: { key: 'k', count: 2 },
    dict: { a: 1 },
  },
};
