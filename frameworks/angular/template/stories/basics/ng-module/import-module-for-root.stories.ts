import { Meta, StoryFn, StoryObj, moduleMetadata } from '@storybook/angular';

import { CHIP_COLOR } from './angular-src/chip-color.token';
import { ChipsGroupComponent } from './angular-src/chips-group.component';
import { ChipsModule } from './angular-src/chips.module';

const meta: Meta<ChipsGroupComponent> = {
  // title: 'Basics / NgModule / forRoot() pattern',
  component: ChipsGroupComponent,
  decorators: [
    moduleMetadata({
      imports: [ChipsModule.forRoot()],
    }),
  ],
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

export default meta;

type Story = StoryObj<ChipsGroupComponent>;

export const Base: Story = {
  name: 'Chips group',
};

export const WithCustomProvider: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: CHIP_COLOR,
          useValue: 'yellow',
        },
      ],
    }),
  ],
  name: 'Chips group with overridden provider',
};
