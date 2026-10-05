import type { Meta, StoryObj } from '@storybook/svelte';

import Features from './components/Features.svelte';
import { expectStyle } from './expectStyle';

const meta = {
  title: 'StyleX/Features',
  component: Features,
} satisfies Meta<typeof Features>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `stylex.keyframes`: the paused animation shows its first keyframe, not the base colour */
export const Keyframes: Story = {
  play: async ({ canvas }) => {
    await expectStyle(canvas.getByTestId('keyframes'), { backgroundColor: 'rgb(253, 230, 138)' });
  },
};

/** `defineConsts` from `consts.stylex.ts`, inlined at compile time */
export const Consts: Story = {
  play: async ({ canvas }) => {
    await expectStyle(canvas.getByTestId('consts'), { padding: '12px' });
  },
};

/** A pseudo-class, an `@supports` query, and an `@media` query from `defineConsts` */
export const Conditions: Story = {
  play: async ({ canvas }) => {
    const wideColor = window.matchMedia('(min-width: 320px)').matches
      ? 'rgb(255, 255, 255)'
      : 'rgb(17, 24, 39)';
    await expectStyle(canvas.getByTestId('enabled'), {
      backgroundColor: 'rgb(29, 78, 216)',
      borderRadius: '8px',
      color: wideColor,
    });
    await expectStyle(canvas.getByTestId('disabled'), { backgroundColor: 'rgb(156, 163, 175)' });
  },
};

/** `stylex.when.siblingBefore` with `defaultMarker`: the label reacts to the checkbox before it */
export const Markers: Story = {
  play: async ({ canvas, userEvent }) => {
    const label = canvas.getByTestId('marked');
    await expectStyle(label, { color: 'rgb(17, 24, 39)' });
    await userEvent.click(canvas.getByRole('checkbox'));
    await expectStyle(label, { color: 'rgb(21, 128, 61)' });
  },
};
