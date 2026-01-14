import { useState } from 'react';

import type { StoryContext } from '@storybook/react-vite';

import { fn, screen, within } from 'storybook/test';

import preview from '../../../../../../.storybook/preview';
import { Zoom } from './zoom';

const openDialog = async (context: StoryContext<typeof Zoom>) => {
  const zoom = await context.canvas.findByRole('button', { name: 'Change zoom level' });
  await context.userEvent.click(zoom);
  return screen.findByRole('dialog');
};

const meta = preview.meta({
  component: Zoom,
  args: {
    value: 1,
    zoomIn: fn(),
    zoomOut: fn(),
    zoomTo: fn(),
  },
  render: (args: Parameters<typeof Zoom>[0]) => {
    const [value, setValue] = useState(args.value);
    return (
      <Zoom
        {...{
          value,
          zoomIn: () => setValue(value + 0.5),
          zoomOut: () => setValue(value - 0.5),
          zoomTo: setValue,
        }}
      />
    );
  },
  play: async (context) => {
    await openDialog(context as any);
  },
});

export default meta;

export const Default = meta.story({});

export const ZoomIn = meta.story({
  play: async (context) => {
    const dialog = await openDialog(context as any);
    const zoomIn = await within(dialog).findByRole('button', { name: 'Zoom in' });
    await context.userEvent.click(zoomIn);
  },
});

export const ZoomOut = meta.story({
  play: async (context) => {
    const dialog = await openDialog(context as any);
    const zoomOut = await within(dialog).findByRole('button', { name: 'Zoom out' });
    await context.userEvent.click(zoomOut);
  },
});

export const Undo = meta.story({
  play: async (context) => {
    const dialog = await openDialog(context as any);
    const zoomIn = await within(dialog).findByRole('button', { name: 'Zoom in' });
    await context.userEvent.click(zoomIn);
    const undo = await within(dialog).findByRole('button', { name: 'Reset zoom' });
    await context.userEvent.click(undo);
  },
});

export const MaxZoom = meta.story({
  args: {
    value: 4,
  },
});

export const MinZoom = meta.story({
  args: {
    value: 0.25,
  },
});
