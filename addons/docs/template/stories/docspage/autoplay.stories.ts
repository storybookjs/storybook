import { expect, within } from '@storybook/test';

export default {
  component: globalThis.Components.Pre,
  tags: ['autodocs'],
  args: { text: 'Play has not run' },
  parameters: { chromatic: { disable: true } },
};

// Should not autoplay
export const NoAutoplay = {
  play: async ({ viewMode, canvasElement }) => {
    const pre = await within(canvasElement).findByText('Play has not run');
    if (viewMode === 'docs') {
      pre.innerText = 'Play should not have run!';
      // Sort of pointless
      expect(viewMode).not.toBe('docs');
    } else {
      pre.innerText = 'Play has run';
    }
  },
};

// Should autoplay
export const Autoplay = {
  parameters: { docs: { story: { autoplay: true } } },
  play: async ({ canvasElement }) => {
    const pre = await within(canvasElement).findByText('Play has not run');
    pre.innerText = 'Play has run';
  },
};
