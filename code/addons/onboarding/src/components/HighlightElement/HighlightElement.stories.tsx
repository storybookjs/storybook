import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';

import { HighlightElement } from './HighlightElement';

const meta: Meta<typeof HighlightElement> = {
  component: HighlightElement,
  parameters: {
    layout: 'centered',
    chromatic: {
      disableSnapshot: true,
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <>
      <HighlightElement targetSelector="#the-button" />
      <button
        id="the-button"
        style={{
          borderRadius: 20,
          border: '1px solid #c9c9ff',
          padding: 6,
        }}
      >
        I should be highlighted
      </button>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.parentElement!);
    const button = canvas.getByRole('button');
    await expect(button).toHaveStyle('box-shadow: rgba(2,156,253,1) 0 0 2px 1px');
  },
};

export const Pulsating: Story = {
  render: () => (
    <>
      <HighlightElement targetSelector="#the-button" pulsating />
      <button
        id="the-button"
        style={{
          borderRadius: 20,
          border: '1px solid #c9c9ff',
          padding: 6,
        }}
      >
        I should be pulsating
      </button>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.parentElement!);
    const button = canvas.getByRole('button');
    await expect(button).toHaveStyle(
      'animation: 3s ease-in-out 0s infinite normal none running pulsate'
    );
  },
};
