import type { Meta, StoryObj } from '@storybook/angular';

import { STORY_RENDERED, UPDATE_STORY_ARGS } from 'storybook/internal/core-events';

import { addons, useArgs } from 'storybook/preview-api';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import ColorPickerComponent from './color-picker.component';

/**
 * These stories exercise native `@storybook/angular` support for Angular's `model()` signal.
 *
 * `color = model<string>('#345F92')` produces a two-way binding: an input `color` plus a
 * compiler-synthesized `colorChange` output. Storybook now surfaces `color` as a Control and
 * `colorChange` as an Action automatically — no hand-written `Args` interface / manual
 * `argTypes` workaround is required (contrast with the `signal/` template stories, whose
 * comments note Compodoc does not support signal inputs/outputs).
 */
const meta: Meta<ColorPickerComponent> = {
  component: ColorPickerComponent,
  tags: ['autodocs'],
  // Use `fn` to spy on the `colorChange` arg, which will appear in the actions panel once
  // the synthesized `model()` output emits: https://storybook.js.org/docs/essentials/actions
  args: {
    colorChange: fn(),
  },
};

export default meta;

type Story = StoryObj<ColorPickerComponent>;

/**
 * `colorChange` appears as an Action (fires on emit) and `color` is a Control/arg.
 *
 * `play`:
 * 1. asserts the initial `color` arg rendered (it reached the component instance);
 * 2. emits `colorChange` from inside the component and asserts the action spy received it.
 */
export const ControlsAndActions: Story = {
  args: {
    color: '#345F92',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // `color` is a Control/arg: its value reached the component instance and rendered.
    await expect(canvas.getByTestId('current-color')).toHaveTextContent('#345F92');

    // Emitting the synthesized `model()` output (`colorChange`) fires the Action.
    await userEvent.click(canvas.getByTestId('emit-green'));
    await expect(args.colorChange).toHaveBeenCalledWith('#00FF00');
  },
};

/**
 * Positive two-way `[(color)]` round-trip plus the live args-update path.
 *
 * `play` runs the sequence:
 * 1. initial render → assert the initial `args.color` reached the component instance;
 * 2. push a live arg change over the channel → assert the new value reaches the
 *    instance (the highest-risk path now that `color` is an Input);
 * 3. trigger an in-component `colorChange` emission → assert it round-trips back to
 *    `args.color` (positive two-way `[(color)]`);
 * 4. assert the action received `colorChange`.
 */
export const TwoWayRoundTrip: Story = {
  // Live args updates inside `play` disrupt the Vitest runner; sandbox + Chromatic cover it.
  tags: ['!vitest'],
  args: {
    color: '#345F92',
  },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      props: {
        ...args,
        // Two-way `[(color)]`: an emitted `colorChange` writes back to the `color` arg.
        colorChange: (value: string) => {
          args.colorChange?.(value);
          updateArgs({ color: value });
        },
      },
    };
  },
  play: async ({ canvasElement, args, id }) => {
    const canvas = within(canvasElement);
    const channel = addons.getChannel();

    // 1. Initial render: the initial `args.color` reached the component instance.
    await expect(canvas.getByTestId('current-color')).toHaveTextContent('#345F92');

    // 2. A live arg change (Controls/args update) reaches the Input.
    channel.emit(UPDATE_STORY_ARGS, { storyId: id, updatedArgs: { color: '#FF0000' } });
    await new Promise((resolve) => channel.once(STORY_RENDERED, resolve));
    await waitFor(async () => {
      await expect(canvas.getByTestId('current-color')).toHaveTextContent('#FF0000');
    });

    // 3. In-component `colorChange` emission round-trips back to `args.color`.
    await userEvent.click(canvas.getByTestId('emit-green'));
    await waitFor(async () => {
      await expect(canvas.getByTestId('current-color')).toHaveTextContent('#00FF00');
    });

    // 4. The action received `colorChange`.
    await expect(args.colorChange).toHaveBeenCalledWith('#00FF00');
  },
};
