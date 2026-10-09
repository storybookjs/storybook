'use client';

import preview from '#.storybook/preview';

import { expect } from 'storybook/test';

import { GreetingForm } from './GreetingForm';

/**
 * A Server Action of a story with "use client": the form posts to the Next.js server, which runs in
 * the browser, as the app does.
 */
const meta = preview.meta({
  component: GreetingForm,
});

export const Default = meta.story({
  play: async ({ canvas, userEvent }) => {
    const name = await canvas.findByRole('textbox', { name: 'Name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Server Components');
    await userEvent.click(canvas.getByRole('button', { name: 'Greet' }));
    await expect(
      await canvas.findByText('Hello, Server Components, from a Server Action')
    ).toBeVisible();
  },
});
