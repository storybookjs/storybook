import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';

import { getRouter } from '@storybook/experimental-nextjs-vite/router.mock';

import Router, { useRouter } from 'next/router';

function Component() {
  const router = useRouter();
  const searchParams = router.query;

  const routerActions = [
    {
      cb: () => router.back(),
      name: 'Go back',
    },
    {
      cb: () => router.forward(),
      name: 'Go forward',
    },
    {
      cb: () => router.prefetch('/prefetched-html'),
      name: 'Prefetch',
    },
    {
      // @ts-expect-error (old API)
      cb: () => router.push('/push-html', { forceOptimisticNavigation: true }),
      name: 'Push HTML',
    },
    {
      // @ts-expect-error (old API)
      cb: () => router.replace('/replaced-html', { forceOptimisticNavigation: true }),
      name: 'Replace',
    },
  ];

  return (
    <div>
      <div>Router pathname: {Router.pathname}</div>
      <div>pathname: {router.pathname}</div>
      <div>
        searchparams:{' '}
        <ul>
          {Object.entries(searchParams).map(([key, value]) => (
            <li key={key}>
              {key}: {value}
            </li>
          ))}
        </ul>
      </div>
      {routerActions.map(({ cb, name }) => (
        <div key={name} style={{ marginBottom: '1em' }}>
          <button type="button" onClick={cb}>
            {name}
          </button>
        </div>
      ))}
    </div>
  );
}

export default {
  component: Component,
  parameters: {
    nextjs: {
      router: {
        pathname: '/hello',
        query: {
          foo: 'bar',
        },
        prefetch: () => {
          console.log('custom prefetch');
        },
      },
    },
  },
} as Meta<typeof Component>;

export const Default: StoryObj<typeof Component> = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const routerMock = getRouter();

    await step('Router property overrides should be available in useRouter fn', async () => {
      await expect(Router.pathname).toBe('/hello');
      await expect(Router.query).toEqual({ foo: 'bar' });
    });

    await step(
      'Router property overrides should be available in default export from next/router',
      async () => {
        await expect(Router.pathname).toBe('/hello');
        await expect(Router.query).toEqual({ foo: 'bar' });
      }
    );

    await step('Asserts whether forward hook is called', async () => {
      const forwardBtn = await canvas.findByText('Go forward');
      await userEvent.click(forwardBtn);
      await expect(routerMock.forward).toHaveBeenCalled();
    });

    await step('Asserts whether custom prefetch hook is called', async () => {
      const prefetchBtn = await canvas.findByText('Prefetch');
      await userEvent.click(prefetchBtn);
      await expect(routerMock.prefetch).toHaveBeenCalledWith('/prefetched-html');
    });
  },
};
