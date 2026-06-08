import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';

import { WhereSelector } from './WhereSelector.tsx';
import './whereselector.css';

const meta = {
  title: 'WhereSelector',
  component: WhereSelector,
} satisfies Meta<typeof WhereSelector>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const link = within(canvas).getByRole('link');
    await expect(link).toHaveComputedStyle({ color: 'rgb(0, 0, 0)' });
  },
};

export const Hover: Story = {
  parameters: {
    pseudo: { hover: true },
  },
  play: async ({ canvas }) => {
    const link = within(canvas).getByRole('link');
    await waitFor(async () => {
      await expect(link).toHaveComputedStyle({ color: 'rgb(255, 0, 0)' });
    });
  },
};

export const FocusVisible: Story = {
  parameters: {
    pseudo: { focusVisible: true },
  },
  play: async ({ canvas }) => {
    const link = within(canvas).getByRole('link');
    await waitFor(async () => {
      // The :where(:focus-visible) rule has specificity 0-1-0, same as :hover.
      // With the fix, the ancestor selector also has specificity 0-1-0,
      // so focus-visible correctly applies blue (comes after hover in the stylesheet).
      await expect(link).toHaveComputedStyle({ color: 'rgb(0, 0, 255)' });
    });
  },
};

export const FocusVisibleAndHover: Story = {
  parameters: {
    pseudo: { focusVisible: true, hover: true },
  },
  play: async ({ canvas }) => {
    const link = within(canvas).getByRole('link');
    await waitFor(async () => {
      // Both states active: mixed :where() wrapping means :focus-visible is wrapped
      // but :hover is not, so both selectors contribute. The combined rule
      // .textLink:where(:focus-visible):hover should make the text bold.
      await expect(link).toHaveComputedStyle({ fontWeight: '700' });
    });
  },
};
