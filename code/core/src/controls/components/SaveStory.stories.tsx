import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fireEvent, fn, within } from 'storybook/test';

import { SaveStory } from './SaveStory';

const meta = {
  component: SaveStory,
  args: {
    saveStory: fn(),
    createStory: fn(),
    resetArgs: fn(),
    portalSelector: '#portal-container',
  },
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: '100vh' }}>
        <Story />
        <div id="portal-container" />
      </div>
    ),
  ],
  tags: ['!vitest'],
} satisfies Meta<typeof SaveStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Creating = {
  play: async ({ canvas }) => {
    const createButton = await canvas.findByRole('button', { name: /Create/i });
    await fireEvent.click(createButton);
    await new Promise((resolve) => setTimeout(resolve, 300));
  },
} satisfies Story;

export const Created: Story = {
  play: async ({ canvas, context }) => {
    await Creating.play(context);

    const dialog = await canvas.findByRole('dialog');
    const input = await within(dialog).findByRole('textbox');
    await fireEvent.change(input, { target: { value: 'MyNewStory' } });
    await fireEvent.submit(dialog.getElementsByTagName('form')[0]);
    await expect(context.args.createStory).toHaveBeenCalledWith('MyNewStory');
  },
};

export const CreatingFailed: Story = {
  args: {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    createStory: fn((...args) => Promise.reject<any>(new Error('Story already exists.'))),
  },
  play: Created.play,
};
