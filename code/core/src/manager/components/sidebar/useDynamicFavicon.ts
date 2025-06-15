/* eslint-env browser */
import { useEffect, useRef } from 'react';

const STATUSES = ['active', 'critical', 'negative', 'positive', 'warning'] as const;

let initialIcon: string | undefined;

export const getFaviconUrl = (link: HTMLLinkElement, status?: (typeof STATUSES)[number]) => {
  initialIcon ??= link.href || `./favicon.svg`;
  const href = initialIcon + (status && STATUSES.includes(status) ? `?status=${status}` : '');

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(href);
    img.onerror = () => resolve(initialIcon!);
    img.src = href;
  });
};

export const useDynamicFavicon = (status?: (typeof STATUSES)[number]) => {
  const link = useRef(document.head.querySelector<HTMLLinkElement>("link[rel*='icon']"));
  useEffect(() => {
    const element = link.current;
    if (element) {
      getFaviconUrl(element, status).then(
        (href) => {
          element.href = href;
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
