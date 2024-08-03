import type { Meta, StoryObj } from '@storybook/react';
import { ControlsParameters, SubcomponentA, SubcomponentB } from './ControlsParameters';

/**
 * Reference stories to be used by the Controls stories
 */
const meta = {
  title: 'examples/Stories for the Controls Block with Subcomponents',
  component: ControlsParameters,
  subcomponents: { SubcomponentA, SubcomponentB },
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
} satisfies Meta<typeof ControlsParameters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoParameters: Story = {
  argTypes: {
    // @ts-expect-error Story type is trying to force us to use real props as args
    extraStoryArgType: {
      type: { name: 'string' },
      name: 'Extra Story',
      description: 'An extra argtype added at the story level',
      table: { defaultValue: { summary: "'a default value'" } },
    },
  },
};
