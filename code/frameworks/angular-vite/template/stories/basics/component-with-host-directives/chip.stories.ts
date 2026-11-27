import type { Meta, StoryObj } from '@storybook/angular-vite';

import { expect, fn, userEvent } from 'storybook/test';

import { ChipComponent } from './chip.component';

// The inputs and outputs `hostDirectives` exposes are not members of `ChipComponent`, so its type
// alone does not describe these args.
interface ChipArgs {
  label: string;
  tooltip: string;
  shown: () => void;
}

const meta: Meta<ChipArgs> = {
  component: ChipComponent,
  args: {
    shown: fn(),
  },
};

export default meta;

type Story = StoryObj<ChipArgs>;

export const Chip: Story = {
  args: {
    label: 'Chip',
    tooltip: 'Exposed through a host directive',
  },
  play: async ({ canvas, args }) => {
    const chip = canvas.getByText('Chip');

    await expect(chip.closest('storybook-chip')).toHaveAttribute(
      'title',
      'Exposed through a host directive'
    );

    await userEvent.click(chip);
    await expect(args.shown).toHaveBeenCalled();
  },
};
