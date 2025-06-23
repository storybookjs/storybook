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

export const All = {
  render: ({ size }: { size: number }) => {
    return (
      <div style={{ display: 'flex', gap: size / 2 }}>
        <img width={size} height={size} src={'./favicon.svg'} />
        <img width={size} height={size} src={'./favicon.svg?status=active'} />
        <img width={size} height={size} src={'./favicon.svg?status=positive'} />
        <img width={size} height={size} src={'./favicon.svg?status=warning'} />
        <img width={size} height={size} src={'./favicon.svg?status=negative'} />
        <img width={size} height={size} src={'./favicon.svg?status=critical'} />
      </div>
    );
  },
};
export const Default = {};
export const Active = { args: { status: 'active' } };
export const Positive = { args: { status: 'positive' } };
export const Warning = { args: { status: 'warning' } };
export const Negative = { args: { status: 'negative' } };
export const Critical = { args: { status: 'critical' } };
