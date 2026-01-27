import { useState } from 'react';

import type { StoryContext } from '@storybook/react-vite';

import { Simulate } from 'react-dom/test-utils';
import { expect, fn, screen, waitFor, within } from 'storybook/test';

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
          zoomBy: (delta: number) => setValue(Math.max(0.01, value + delta)),
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
    value: 8,
  },
});

export const MinZoom = meta.story({
  args: {
    value: 0.25,
  },
});

export const ArrowUpKey = meta.story({
  args: {},
  play: async ({ canvas, userEvent }) => {
    const zoom = await canvas.findByRole('button', { name: 'Change zoom level' });
    zoom.focus();
    await userEvent.keyboard('[ArrowUp]');
    expect(screen.getByRole('button', { name: 'Change zoom level' })).toHaveTextContent('101%');
  },
});

export const ArrowDownKey = meta.story({
  args: {},
  play: async ({ canvas, userEvent }) => {
    const zoom = await canvas.findByRole('button', { name: 'Change zoom level' });
    await zoom.focus();
    await userEvent.keyboard('[ArrowDown]');
    expect(screen.getByRole('button', { name: 'Change zoom level' })).toHaveTextContent('99%');
  },
});

export const PageUpKey = meta.story({
  args: {},
  play: async ({ canvas, userEvent }) => {
    const zoom = await canvas.findByRole('button', { name: 'Change zoom level' });
    zoom.focus();
    await userEvent.keyboard('[PageUp]');
    expect(screen.getByRole('button', { name: 'Change zoom level' })).toHaveTextContent('150%');
  },
});

export const PageDownKey = meta.story({
  args: {},
  play: async ({ canvas, userEvent }) => {
    const zoom = await canvas.findByRole('button', { name: 'Change zoom level' });
    zoom.focus();
    await userEvent.keyboard('[PageDown]');
    expect(screen.getByRole('button', { name: 'Change zoom level' })).toHaveTextContent('50%');
  },
});

export const HomeKey = meta.story({
  args: {},
  play: async ({ canvas, userEvent }) => {
    const zoom = await canvas.findByRole('button', { name: 'Change zoom level' });
    zoom.focus();
    await userEvent.keyboard('[Home]');
    expect(screen.getByRole('button', { name: 'Change zoom level' })).toHaveTextContent('400%');
  },
});

export const EndKey = meta.story({
  args: {},
  play: async ({ canvas, userEvent }) => {
    const zoom = await canvas.findByRole('button', { name: 'Change zoom level' });
    zoom.focus();
    await userEvent.keyboard('[End]');
    expect(screen.getByRole('button', { name: 'Change zoom level' })).toHaveTextContent('25%');
  },
});

export const WheelUp = meta.story({
  args: {},
  play: async ({ canvas }) => {
    const zoom = await canvas.findByRole('button', { name: 'Change zoom level' });
    Simulate.wheel(zoom, { deltaY: -100 });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Change zoom level' })).toHaveTextContent('150%')
    );
  },
});

export const WheelDown = meta.story({
  args: {},
  play: async ({ canvas }) => {
    const zoom = await canvas.findByRole('button', { name: 'Change zoom level' });
    Simulate.wheel(zoom, { deltaY: 100 });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Change zoom level' })).toHaveTextContent('50%')
    );
  },
});
