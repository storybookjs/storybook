import type { Meta, StoryObj } from '@storybook/angular';
import { StoryFn, moduleMetadata } from '@storybook/angular';

import { ChipComponent } from './angular-src/chip.component';
import { ChipsModule } from './angular-src/chips.module';

const meta: Meta<ChipComponent> = {
  component: ChipComponent,
  decorators: [
    moduleMetadata({
      imports: [ChipsModule.forRoot()],
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
