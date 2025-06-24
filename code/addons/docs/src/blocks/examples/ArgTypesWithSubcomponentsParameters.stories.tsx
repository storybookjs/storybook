import type { Meta, StoryObj } from '@storybook/react-vite';

import { ArgTypesParameters, SubcomponentA, SubcomponentB } from './ArgTypesParameters';

/** Reference stories to be used by the ArgTypes stories */
const meta = {
  title: 'examples/Stories for the ArgTypes Block with Subcomponents',
  component: ArgTypesParameters,
  subcomponents: { SubcomponentA, SubcomponentB } as Record<string, React.ComponentType<any>>,
  args: { b: 'b' },
  argTypes: {
    // @ts-expect-error Meta type is trying to force us to use real props as args
    extraMetaArgType: {
      type: { name: 'string' },
      name: 'Extra Meta',
      description: 'An extra argtype added at the meta level',
      table: { defaultValue: { summary: "'a default value'" } },
    },
  },
} satisfies Meta<typeof ArgTypesParameters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoParameters: Story = {};
