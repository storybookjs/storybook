import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect } from 'storybook/test';

import { WebView } from './WebView.ts';

// A story that covers the whole viewport with the highest z-index there is.
const Cover = () => (
  <div
    data-testid="cover"
    style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: 'rebeccapurple' }}
  />
);

const meta = {
  component: Cover,
  title: 'WebView',
  parameters: { layout: 'fullscreen', chromatic: { disableSnapshot: true } },
} satisfies Meta<typeof Cover>;

export default meta;

type Story = StoryObj<typeof meta>;

const openHost = () =>
  Array.from(document.querySelectorAll('sb-preview')).find((host) => host.matches(':popover-open'));

const elementAtCenterOf = (element: Element) => {
  const { x, y, width, height } = element.getBoundingClientRect();
  return document.elementFromPoint(x + width / 2, y + height / 2);
};

export const ErrorDisplayAboveTheStory: Story = {
  play: async ({ canvas }) => {
    const view = new WebView();
    const cover = canvas.getByTestId('cover');

    view.showErrorDisplay({ message: 'Boom' });
    const host = openHost();

    try {
      await expect(host).toBeDefined();
      await expect(host!.parentElement).toBe(document.documentElement);
      await expect(host!.contains(elementAtCenterOf(host!))).toBe(true);
      // The popover's own box (fit-content, centred, bordered) is reset: the host is the viewport.
      await expect(host!.getBoundingClientRect().toJSON()).toMatchObject({
        x: 0,
        y: 0,
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      });

      view.showMain();

      await expect(host!.isConnected).toBe(false);
      await expect(host!.matches(':popover-open')).toBe(false);
      await expect(elementAtCenterOf(cover)).toBe(cover);
    } finally {
      view.showMain();
      host?.remove();
    }
  },
};

export const ErrorDisplayAfterARenderRemovedTheHost: Story = {
  play: async () => {
    const view = new WebView();

    view.showPreparingStory({ immediate: true });
    const host = openHost();

    try {
      // A render that clears <html> takes the host out of the document, which closes it.
      host!.remove();
      view.showErrorDisplay({ message: 'Boom' });

      await expect(openHost()).toBe(host);
      await expect(host!.parentElement).toBe(document.documentElement);
      await expect(host!.contains(elementAtCenterOf(host!))).toBe(true);
    } finally {
      view.showMain();
      host?.remove();
    }
  },
};
