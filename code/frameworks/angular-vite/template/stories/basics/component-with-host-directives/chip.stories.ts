import type { Meta, StoryObj } from '@storybook/angular-vite';

import { ChipComponent } from './chip.component';

const meta: Meta<ChipComponent> = {
  component: ChipComponent,
};

export default meta;

type Story = StoryObj<ChipComponent>;

export const Chip: Story = {
  args: {
    label: 'Chip',
  },
};
