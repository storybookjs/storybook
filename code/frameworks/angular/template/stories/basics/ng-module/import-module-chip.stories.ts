import { Meta, StoryFn, StoryObj, moduleMetadata } from '@storybook/angular';

import { ChipComponent } from './angular-src/chip.component';
import { ChipsModule } from './angular-src/chips.module';

const meta: Meta<ChipComponent> = {
  component: ChipComponent,
  decorators: [
    moduleMetadata({
      imports: [ChipsModule],
    }),
  ],
};

export default meta;

type Story = StoryObj<ChipComponent>;

export const Chip: Story = {
  args: {
    displayText: 'Chip',
  },
  argTypes: {
    removeClicked: { action: 'Remove icon clicked' },
  },
};
