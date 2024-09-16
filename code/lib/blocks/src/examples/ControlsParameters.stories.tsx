import type { Meta, StoryObj } from '@storybook/react';

import { ControlsParameters } from './ControlsParameters';

/** Reference stories to be used by the Controls stories */
const meta = {
  title: 'examples/Stories for the Controls Block',
  component: ControlsParameters,
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

export const Include: Story = {
  ...NoParameters,
  parameters: { docs: { controls: { include: ['a'] } } },
};

export const Exclude: Story = {
  ...NoParameters,
  parameters: { docs: { controls: { exclude: ['a'] } } },
};

export const Sort: Story = {
  ...NoParameters,
  parameters: { docs: { controls: { sort: 'alpha' } } },
};

export const Categories: Story = {
  ...NoParameters,
  argTypes: {
    c: {
      description: 'a description',
      control: {
        type: 'text',
      },
      table: {
        category: 'the first category',
      },
    },
    d: {
      control: {
        type: 'number',
      },
      table: {
        category: 'the first category',
        subcategory: 'a subcategory',
      },
    },
    e: {
      control: {
        type: 'color',
      },
      table: {
        subcategory: 'a subcategory without a category',
      },
    },
    f: {
      table: {
        category: 'the second category',
      },
    },
  } as any,
};
