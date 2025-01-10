import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor } from '@storybook/test';

import Head from 'next/head';

function Component() {
  return (
    <div>
      <Head>
        <title>Next.js Head Title</title>
        <meta property="og:title" content="My page title" key="title" />
      </Head>
      <Head>
        <meta property="og:title" content="My new title" key="title" />
      </Head>
      <p>Hello world!</p>
    </div>
  );
}

export default {
  component: Component,
} as Meta<typeof Component>;

export const Default: StoryObj<typeof Component> = {
  play: async () => {
    await waitFor(() => expect(document.title).toEqual('Next.js Head Title'));
    await expect(document.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
    await expect(
      (document.querySelector('meta[property="og:title"]') as HTMLMetaElement)?.content
    ).toEqual('My new title');
  },
};
