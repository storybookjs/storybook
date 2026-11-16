import { global as globalThis } from '@storybook/global';

import { expect, userEvent as globalUserEvent } from 'storybook/test';

/**
 * Browsers set `view` to the window of every UI event they dispatch, and libraries such as d3-drag
 * rely on it. `@testing-library/user-event` leaves it `null`, so storybook/test patches it. See
 * https://github.com/storybookjs/storybook/issues/33145
 */
export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  args: { label: 'Click me' },
  parameters: { chromatic: { disableSnapshot: true } },
};

export const EventsHaveTheirView = {
  play: async ({ canvas, canvasElement, userEvent }: any) => {
    const views: Record<string, unknown> = {};
    const record = (event: UIEvent) => {
      views[event.type] = event.view;
    };
    for (const type of ['pointerdown', 'mousedown', 'click', 'keydown']) {
      canvasElement.addEventListener(type, record);
    }

    const button = canvas.getByRole('button');
    await userEvent.click(button);
    await userEvent.keyboard('a');
    const ownerWindow = canvasElement.ownerDocument.defaultView;
    await expect(views).toEqual({
      pointerdown: ownerWindow,
      mousedown: ownerWindow,
      click: ownerWindow,
      keydown: ownerWindow,
    });

    // The `userEvent` export, which is not set up per story, is patched too.
    delete views.click;
    await globalUserEvent.click(button);
    await expect(views.click).toBe(ownerWindow);
  },
};
