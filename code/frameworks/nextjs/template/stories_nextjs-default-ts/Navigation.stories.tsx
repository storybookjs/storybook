// usePathname and useSearchParams are only usable if experimental: {appDir: true} is set in next.config.js
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

function Component() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
      // @ts-expect-error (a legacy nextjs api?)
      cb: () => router.push('/push-html', { forceOptimisticNavigation: true }),
      name: 'Push HTML',
    },
    {
      cb: () => router.refresh(),
      name: 'Refresh',
    },
    {
      // @ts-expect-error (a legacy nextjs api?)
      cb: () => router.replace('/replaced-html', { forceOptimisticNavigation: true }),
      name: 'Replace',
    },
  ];

  return (
    <div>
      <div>pathname: {pathname}</div>
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
      appDirectory: true,
      navigation: {
        pathname: '/hello',
        query: {
          foo: 'bar',
        },
      },
    },
  },
} as Meta<typeof Component>;

export const Default: StoryObj<typeof Component> = {};
