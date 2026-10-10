import preview from '#.storybook/preview';

import { expect } from 'storybook/test';

import { RequestInfo } from './RequestInfo';

/**
 * An async Server Component that reads the request of its story, which `parameters.nextjs.headers`
 * sets: `headers()` and `cookies()` of `next/headers`.
 */
const meta = preview.meta({
  component: RequestInfo,
  tags: ['autodocs'],
  parameters: {
    nextjs: { headers: { 'x-greeting': 'Hello from a header', cookie: 'flavor=chocolate' } },
  },
});

export const Default = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Hello from a header')).toBeVisible();
    await expect(canvas.getByText('chocolate')).toBeVisible();
  },
});

export const OtherCookie = meta.story({
  parameters: { nextjs: { headers: { cookie: 'flavor=vanilla' } } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('vanilla')).toBeVisible();
  },
});
