import { Meta, StoryFn, StoryObj, moduleMetadata } from '@storybook/angular';

import { ChipsGroupComponent } from './angular-src/chips-group.component';
import { ChipsModule } from './angular-src/chips.module';

const meta: Meta<ChipsGroupComponent> = {
  // title: 'Basics / NgModule / Module with multiple component',
  component: ChipsGroupComponent,
  decorators: [
    moduleMetadata({
      imports: [ChipsModule],
    }),
  ],
  tags: ['!test', '!vitest'],
  parameters: { chromatic: { disable: true } },
};

export default meta;

type Story = StoryObj<ChipsGroupComponent>;

export const ChipsGroup: Story = {
  args: {
    chips: [
      {
        id: 1,
        text: 'Chip 1',
      },
      {
        id: 2,
        text: 'Chip 2',
      },
    ],
  },
  argTypes: {
    removeChipClick: { action: 'Remove chip' },
    removeAllChipsClick: { action: 'Remove all chips clicked' },
  },
};
