import React, { useEffect, useState } from 'react';

import { getFaviconUrl } from './useDynamicFavicon';

export default {
  title: 'Dynamic Favicon',
  args: {
    size: 16,
  },
  argTypes: {
    size: {
      control: 'select',
      options: [16, 32, 64, 128, 256],
    },
    status: {
      control: 'select',
      options: ['active', 'positive', 'warning', 'negative', 'critical'],
    },
  },
  render: ({ status, size }: { status?: Parameters<typeof getFaviconUrl>[1]; size?: number }) => {
    const [favicon, setFavicon] = useState<string | null>(null);

    useEffect(() => {
      getFaviconUrl(undefined, status).then(({ href }) => setFavicon(href));
    }, [status]);

    return favicon ? <img width={size} height={size} src={favicon} /> : <></>;
  },
};

export const Statuses = {
  argTypes: {
    status: {
      table: {
        disable: true,
      },
    },
  },
  parameters: {
    chromatic: {
      // Dynamic favicon status doesn't work in static builds
      disableSnapshot: true,
    },
  },
  render: ({ size }: { size: number }) => (
    <div style={{ display: 'flex', gap: size / 2 }}>
      <img role="presentation" width={size} height={size} src={'./favicon.svg'} />
      <img role="presentation" width={size} height={size} src={'./favicon.svg?status=active'} />
      <img role="presentation" width={size} height={size} src={'./favicon.svg?status=positive'} />
      <img role="presentation" width={size} height={size} src={'./favicon.svg?status=warning'} />
      <img role="presentation" width={size} height={size} src={'./favicon.svg?status=negative'} />
      <img role="presentation" width={size} height={size} src={'./favicon.svg?status=critical'} />
    </div>
  ),
};

export const Sizes = {
  argTypes: {
    size: {
      table: {
        disable: true,
      },
    },
  },
  render: ({ status }: { status?: Parameters<typeof getFaviconUrl>[1] }) => (
    <div style={{ display: 'flex', gap: 10 }}>
      <img role="presentation" width={16} height={16} src={`./favicon.svg?status=${status}`} />
      <img role="presentation" width={32} height={32} src={`./favicon.svg?status=${status}`} />
      <img role="presentation" width={64} height={64} src={`./favicon.svg?status=${status}`} />
      <img role="presentation" width={128} height={128} src={`./favicon.svg?status=${status}`} />
      <img role="presentation" width={256} height={256} src={`./favicon.svg?status=${status}`} />
    </div>
  ),
};
