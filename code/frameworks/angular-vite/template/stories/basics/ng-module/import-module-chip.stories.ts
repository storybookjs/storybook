import type { Meta, StoryObj } from '@storybook/angular-vite';
import { StoryFn, moduleMetadata } from '@storybook/angular-vite';

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
