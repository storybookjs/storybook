import React from 'react';

import preview from '../../../../../.storybook/preview';
import { FocusProxy } from './FocusProxy';

const meta = preview.meta({
  component: FocusProxy,
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

export const Default = meta.story({
  render: () => (
    <FocusProxy htmlFor="focus-button" style={{ padding: 10 }}>
      <button id="focus-button">Focus me</button>
      <div>A bunch of content</div>
      <button>Another button</button>
    </FocusProxy>
  ),
  play: async ({ canvas }) => {
    canvas.getByRole('button', { name: 'Focus me' }).focus();
  },
});
