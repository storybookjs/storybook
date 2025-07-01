/* eslint-env browser */
import { useEffect, useRef } from 'react';

const STATUSES = ['active', 'critical', 'negative', 'positive', 'warning'] as const;

let initialIcon: string | undefined;

export const getFaviconUrl = (
  initialHref: string = './favicon.svg',
  status?: (typeof STATUSES)[number]
) => {
  initialIcon ??= initialHref;
  const href = initialIcon + (status && STATUSES.includes(status) ? `?status=${status}` : '');

  return new Promise<{ href: string; status?: (typeof STATUSES)[number] }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ href, status });
    img.onerror = () => resolve({ href: initialIcon!, status });
    img.src = href;
  });
};

export const useDynamicFavicon = (status?: (typeof STATUSES)[number]) => {
  const link = useRef(document.head.querySelector<HTMLLinkElement>("link[rel*='icon']"));
  useEffect(() => {
    const element = link.current;
    if (element) {
      getFaviconUrl(element.href, status).then(
        (result) => {
          if (result.status === status) {
            element.href = result.href;
            element.dataset.status = result.status;
          }
        },
        () => {
          element.href = initialIcon!;
        }
      );
      return () => {
        element.href = initialIcon!;
      };
    }
  }, [status]);
};
