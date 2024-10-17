import type { Meta, StoryObj } from '@storybook/react';

import { EmptyExample } from './EmptyExample';

const meta = {
  title: 'examples/Stories for the Canvas Block',
  component: EmptyExample,
} satisfies Meta<typeof EmptyExample>;
export default meta;

type Story = StoryObj<typeof meta>;

export const WithToolbar: Story = {
  parameters: { docs: { canvas: { withToolbar: true } } },
};
export const AdditionalActions: Story = {
  parameters: {
    docs: {
      canvas: {
        additionalActions: [
          {
            title: 'Open in GitHub',
            onClick: () => {
              window.open(
                'https://github.com/storybookjs/storybook/blob/next/code/lib/blocks/src/examples/Button.stories.tsx',
                '_blank'
              );
            },
          },
          {
            title: 'Go to documentation',
            onClick: () => {
              window.open(
                'https://storybook.js.org/docs/essentials/controls#annotation',
                '_blank'
              );
            },
          },
        ],
      },
    },
  },
};

export const SourceStateShown: Story = {
  parameters: { docs: { canvas: { sourceState: 'shown' } } },
};
export const SourceStateHidden: Story = {
  parameters: { docs: { canvas: { sourceState: 'hidden' } } },
};
export const SourceStateNone: Story = {
  parameters: { docs: { canvas: { sourceState: 'none' } } },
};

export const LayoutFullscreen: Story = {
  parameters: { layout: 'fullscreen' },
};
export const LayoutPadded: Story = {
  parameters: { layout: 'padded' },
};
export const LayoutCentered: Story = {
  parameters: { layout: 'centered' },
};

export const DocsCanvasLayoutFullscreen: Story = {
  parameters: { docs: { canvas: { layout: 'fullscreen' } } },
};
export const DocsCanvasLayoutPadded: Story = {
  parameters: { docs: { canvas: { layout: 'padded' } } },
};
export const DocsCanvasLayoutCentered: Story = {
  parameters: { docs: { canvas: { layout: 'centered' } } },
};

export const ClassName: Story = {
  parameters: { docs: { canvas: { className: 'my-custom-classname' } } },
};

export const StoryParameters: Story = {
  parameters: { docs: { story: { inline: false, height: '200px' } } },
};
