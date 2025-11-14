import React from 'react';

import preview from '../../../../../.storybook/preview';
import { FocusProxy, FocusRing, FocusTarget } from './FocusRing';

const meta = preview.meta({
  component: FocusRing,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ display: 'inline-block', padding: 20 }}>
        <Story />
      </div>
    ),
  ],
});

export const Active = meta.story({
  args: {
    active: true,
    children: 'Focused',
  },
});

export const Temporary = meta.story({
  args: {
    active: true,
    children: 'Focused for 1 second',
    highlightDuration: 1000,
  },
});

export const Proxy = meta.story({
  render: () => (
    <FocusProxy targetId="focus-button" style={{ padding: 10 }}>
      <button data-target-id="focus-button">Focus me</button>
      <div>A bunch of content</div>
      <button>Another button</button>
    </FocusProxy>
  ),
  play: async ({ canvas }) => {
    canvas.getByRole('button', { name: 'Focus me' }).focus();
  },
});

export const Target = meta.story({
  render: () => (
    <>
      <button onClick={() => (window.location.hash = '#focus-target')}>Set target</button>
      <FocusTarget
        targetHash="focus-target"
        style={{ marginTop: 5, padding: 5 }}
        highlightDuration={2000}
      >
        <div>Focused for 2 seconds</div>
      </FocusTarget>
    </>
  ),
  play: async ({ canvas, userEvent }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await userEvent.click(canvas.getByRole('button', { name: 'Set target' }));
  },
  beforeEach: () => {
    window.location.hash = '';
  },
});
