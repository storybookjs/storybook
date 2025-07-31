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
  const links = useRef(document.head.querySelectorAll<HTMLLinkElement>("link[rel*='icon']"));
  useEffect(() => {
    let isMounted = true;
    const [element, ...others] = links.current;
    // Custom filenames are not supported, so if there's other icon links, we don't do anything
    if (element && !others.length) {
      getFaviconUrl(element.href, status).then(
        (result) => {
          if (isMounted && result.status === status && element.dataset.status !== status) {
            element.href = result.href;
            if (result.status) {
              element.dataset.status = result.status;
            } else {
              delete element.dataset.status;
            }
          }
        },
        () => {
          if (isMounted) {
            element.href = initialIcon!;
          }
        }
      );
      return () => {
        isMounted = false;
        element.href = initialIcon!;
      };
    }
  }, [status]);
};
