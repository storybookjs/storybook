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
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      document.head.appendChild(link);
      getFaviconUrl(link, status).then((href) => setFavicon(href));
    }, [status]);

    return (
      <>
        {favicon && (
          <svg width={size} height={size} viewBox="0 0 160 160">
            <use href={favicon} />
          </svg>
        )}
      </>
    );
  },
};

export const Default = {};
export const Active = { args: { status: 'active' } };
export const Positive = { args: { status: 'positive' } };
export const Warning = { args: { status: 'warning' } };
export const Negative = { args: { status: 'negative' } };
export const Critical = { args: { status: 'critical' } };
