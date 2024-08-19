import type { Meta, StoryObj } from '@storybook/vue3';

import Component from './reference-type-props/component.vue';

const meta = {
  component: Component,
  tags: ['autodocs'],
} satisfies Meta<typeof Component>;

type Story = StoryObj<typeof meta>;
export default meta;

enum MyEnum {
  Small,
  Medium,
  Large,
}

export const ReferenceTypeProps: Story = {
  args: {
    foo: 'Foo',
    baz: true,
    stringArray: ['Foo', 'Bar', 'Baz'],
    bar: 1,
    unionOptional: 'Foo',
    union: 'Foo',
    inlined: { foo: 'Foo' },
    nested: { nestedProp: 'Nested Prop' },
    nestedIntersection: { nestedProp: 'Nested Prop', additionalProp: 'Additional Prop' },
    array: [{ nestedProp: 'Nested Prop' }],
    literalFromContext: 'Uncategorized',
    enumValue: MyEnum.Small,
  },
};
