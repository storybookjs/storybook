import { global as globalThis } from '@storybook/global';
import { expect } from '@storybook/test';

import { MINIMAL_VIEWPORTS } from '@storybook/addon-viewport';

// these stories only work with `viewportStoryGlobals` set to false
// because the `default` prop is dropped and because, `values` changed to `options` and is now an object

const first = Object.keys(MINIMAL_VIEWPORTS)[0];

export default {
  component: globalThis.Components.Button,
  args: {
    label: 'Click Me!',
  },
  parameters: {
    viewport: {
      viewports: MINIMAL_VIEWPORTS,
    },
    chromatic: { disable: true },
  },
};

export const Basic = {
  parameters: {},
};

export const Selected = {
  parameters: {
    viewport: {
      defaultViewport: first,
    },
  },
  play: async () => {
    const viewportStyles = MINIMAL_VIEWPORTS[first].styles;
    const viewportDimensions = {
      width: typeof viewportStyles === 'object' && Number.parseInt(viewportStyles!.width, 10),
      height: typeof viewportStyles === 'object' && Number.parseInt(viewportStyles!.height, 10),
    };

    const windowDimensions = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    await expect(viewportDimensions).toEqual(windowDimensions);
  },
  tags: ['!test'],
};

export const Orientation = {
  parameters: {
    viewport: {
      defaultViewport: first,
      defaultOrientation: 'landscape',
    },
  },
};

export const Custom = {
  parameters: {
    viewport: {
      defaultViewport: 'phone',
      viewports: {
        phone: {
          name: 'Phone Width',
          styles: {
            height: '600px',
            width: '100vh',
          },
          type: 'mobile',
        },
      },
    },
  },
};

export const Disabled = {
  parameters: {
    viewport: { disable: true },
  },
};
