import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';

import { getRouter } from '@storybook/experimental-nextjs-vite/navigation.mock';

import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
  useSelectedLayoutSegment,
  useSelectedLayoutSegments,
} from 'next/navigation';

function Component() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const segment = useSelectedLayoutSegment();
  const segments = useSelectedLayoutSegments();

  const searchParamsList = searchParams ? Array.from(searchParams.entries()) : [];

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
      cb: () => router.refresh(),
      name: 'Refresh',
    },
    {
      // @ts-expect-error (old API)
      cb: () => router.replace('/replaced-html', { forceOptimisticNavigation: true }),
      name: 'Replace',
    },
  ];

  return (
    <div>
      <div>pathname: {pathname}</div>
      <div>segment: {segment}</div>
      <div>segments: {segments.join(',')}</div>
      <div>
        searchparams:{' '}
        <ul>
          {searchParamsList.map(([key, value]) => (
            <li key={key}>
              {key}: {value}
            </li>
          ))}
        </ul>
      </div>
      <div>
        params:{' '}
        <ul>
          {Object.entries(params).map(([key, value]) => (
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

type Story = StoryObj<typeof Component>;

export default {
  component: Component,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
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

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const routerMock = getRouter();

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

export const WithSegmentDefined: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        segments: ['dashboard', 'settings'],
      },
    },
  },
};

export const WithSegmentDefinedForParams: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        segments: [
          ['slug', 'hello'],
          ['framework', 'nextjs'],
        ],
      },
    },
  },
};
