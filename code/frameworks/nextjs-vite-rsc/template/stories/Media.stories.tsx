import preview from '#.storybook/preview';

import { expect } from 'storybook/test';

import { Media } from './Media';

/** `next/image`, of a file of `public/` and of a static import, and `next/font/google`. */
const meta = preview.meta({
  component: Media,
});

export const Default = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('img', { name: 'Next.js logo' })).toBeVisible();
    await expect(canvas.getByRole('img', { name: 'Accessibility' })).toBeVisible();
  },
});
