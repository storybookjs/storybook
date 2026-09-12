import type { Meta, StoryObj } from '@storybook/vue3';

import NamedTypeDetails from './NamedTypeDetails.vue';
import { Color, Level } from './named-types.ts';
import type { AliasA, BigInterface } from './named-types.ts';

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
    // A finite literal can never satisfy the mutual AliasA/AliasB cycle, and
    // extraction reads the prop's type, not this value — the cast is fixture-only.
    cyclic: { peer: { peer: null } } as unknown as AliasA,
    big: {} as BigInterface,
    builtin: new Date(0),
    inlined: { foo: 'foo', bar: 1 },
    namespaced: { key: 'k', count: 2 },
    dict: { a: 1 },
    prefs: { locale: 'en-US' },
    localDate: new Date(0),
    picked: { name: 'Ada' },
    partialed: { age: 36 },
  },
};
