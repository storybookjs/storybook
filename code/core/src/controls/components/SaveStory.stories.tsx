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
} satisfies Meta<typeof SaveStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Creating = {
  play: async ({ canvas, id }) => {
    console.log('[Creating story] start of play function', id);
    const createButton = await canvas.findByRole('button', { name: /Create/i });
    console.log('[Creating story] clicking on create button', id);
    await fireEvent.click(createButton);
    await new Promise((resolve) => setTimeout(resolve, 300));
    console.log('[Creating story] end of play function', id);
  },
} satisfies Story;

export const Created: Story = {
  play: async ({ canvas, context, userEvent, id }) => {
    await Creating.play(context);
    const event = userEvent.setup({ delay: null });
    console.log('[Created story] start of play function', id);

    const dialog = await canvas.findByRole('dialog');
    console.log('[Created story] finding input', dialog);
    const input = await within(dialog).findByRole('textbox');
    console.log('[Created story] typing in input', input);
    await event.type(input, 'MyNewStory');

    console.log('[Created story] submitting form', id);
    await fireEvent.submit(dialog.getElementsByTagName('form')[0]);
    console.log('[Created story] waiting for create story to be called', id);
    await expect(context.args.createStory).toHaveBeenCalledWith('MyNewStory');
    console.log('[Created story] end of play function', id);
  },
};

export const CreatingFailed: Story = {
  args: {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    createStory: fn((...args) => Promise.reject<any>(new Error('Story already exists.'))),
  },
  play: Created.play,
};
