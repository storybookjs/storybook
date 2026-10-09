'use client';

import React, { useState } from 'react';

import preview from '#.storybook/preview';

import { expect, fn } from 'storybook/test';

import { Counter } from './Counter';

/**
 * A story file with "use client" renders its stories in the browser: an arg can be a function, like
 * a spy of `storybook/test`, and a `render` function can have state.
 */
const meta = preview.meta({
  component: Counter,
  args: { label: 'Count', onChange: fn() },
});

export const Default = meta.story({
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Count: 0' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Count: 1' }));
    await expect(args.onChange).toHaveBeenLastCalledWith(2);
  },
});

export const StateInRender = meta.story({
  render: function Render(args) {
    const [total, setTotal] = useState(0);
    return (
      <div>
        <Counter
          {...args}
          onChange={(count) => {
            setTotal(count * 10);
            args.onChange?.(count);
          }}
        />
        <output>Total: {total}</output>
      </div>
    );
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Count: 0' }));
    await expect(canvas.getByText('Total: 10')).toBeVisible();
    await expect(args.onChange).toHaveBeenCalledWith(1);
  },
});
