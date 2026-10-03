import type { Meta, StoryObj } from '@storybook/svelte';

import ThemeSurface from './components/ThemeSurface.svelte';
import { withStylexTheme } from './withStylexTheme';
import { expectStyle } from './expectStyle';

const meta = {
  title: 'StyleX/Theme',
  component: ThemeSurface,
  decorators: [withStylexTheme],
} satisfies Meta<typeof ThemeSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

const expectTheme = (surface: HTMLElement, backgroundColor: string, color: string) =>
  expectStyle(surface, { backgroundColor, color });

export const Light: Story = {
  parameters: { stylexTheme: 'light' },
  play: async ({ canvas }) => {
    await expectTheme(canvas.getByTestId('surface'), 'rgb(255, 255, 255)', 'rgb(17, 24, 39)');
  },
};

export const Dark: Story = {
  parameters: { stylexTheme: 'dark' },
  play: async ({ canvas }) => {
    await expectTheme(canvas.getByTestId('surface'), 'rgb(17, 24, 39)', 'rgb(249, 250, 251)');
  },
};

/** Switch the theme with the "StyleX theme" toolbar item */
export const Toolbar: Story = {};

export const ToolbarDark: Story = {
  globals: { stylexTheme: 'dark' },
  play: async ({ canvas }) => {
    await expectTheme(canvas.getByTestId('surface'), 'rgb(17, 24, 39)', 'rgb(249, 250, 251)');
  },
};
