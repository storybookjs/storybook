import { global as globalThis } from '@storybook/global';

// eslint-disable-next-line depend/ban-dependencies
import lodash from 'lodash-es';
// eslint-disable-next-line depend/ban-dependencies
import add from 'lodash-es/add';
// eslint-disable-next-line depend/ban-dependencies
import sum from 'lodash-es/sum';
import { expect, mocked } from 'storybook/test';

// This story is used to test the node module mocking.
//
// lodash is mocked, because sb.mock('lodash') is called in the .storybook/preview.js and the
// __mocks__ directory contains a lodash.js file.
//
// lodash/add is mocked, because sb.mock('lodash/add') is called in the .storybook/preview.js and the
// __mocks__ directory contains a lodash/add.js file.
//
// lodash/sum is automocked, because sb.mock('lodash/sum') is called in the .storybook/preview.js and the
// __mocks__ directory does not contain a lodash/sum.js file. Mocking has to happen at runtime.

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  decorators: [
    (storyFn) =>
      storyFn({
        args: {
          text: `Lodash Version: ${lodash.VERSION} | Mocked Add (1,2): ${add(1, 2)} | Inline Sum (2,2): ${sum([2, 2])}`,
        },
      }),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  beforeEach: () => {
    mocked(sum).mockImplementation(() => {
      return 'mocked 10';
    });
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.innerHTML).toContain('Lodash Version: 1.0.0-mocked!');
    await expect(canvasElement.innerHTML).toContain('Mocked Add (1,2): mocked 3');
    await expect(canvasElement.innerHTML).toContain('Inline Sum (2,2): mocked 10');
  },
};

export const Original = {};
