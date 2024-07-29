/* eslint-disable @typescript-eslint/naming-convention,storybook/prefer-pascal-case */
import { expect, within, userEvent as globalUserEvent } from '@storybook/test';

const meta = {
  component: globalThis.Components.Button,
  parameters: { chromatic: { disable: true } },
  args: { label: 'Button' },
};

export default meta;

export const canvas_is_equal_to_within_canvas_element = {
  async play({ canvas, canvasElement }) {
    const oldCanvas = within(canvasElement);
    await expect(Object.keys(canvas)).toEqual(Object.keys(oldCanvas));
  },
};

// TODO enable this in a later PR, once we have time to QA this properly
// export const context_user_event_is_equal_to_user_event_setup = {
//   async play({ userEvent }) {
//     await expect(userEvent satisfies typeof globalUserEvent).toEqual(globalUserEvent.setup());
//   },
// };
