/* eslint-env browser */
import { useEffect, useRef } from 'react';

const STATUSES = ['active', 'critical', 'negative', 'positive', 'warning'] as const;

let initialIcon: string | undefined;

const setFavicon = (link: HTMLLinkElement, suffix: string = '') => {
  initialIcon ??= link.href || `./favicon.svg`;

  const href = initialIcon.replace(/([^/]+)(\.\w+)([?#].*)?$/, `$1${suffix}$2$3`);
  const img = new Image();
  img.onload = () => (link.href = href);
  img.onerror = () => (link.href = initialIcon!);
  img.src = href;
};

export const useFavicon = (status?: (typeof STATUSES)[number]) => {
  const link = useRef(document.head.querySelector<HTMLLinkElement>("link[rel*='icon']"));
  useEffect(() => {
    const element = link.current;
    if (element) {
      setFavicon(element, status && STATUSES.includes(status) ? `-${status}` : '');
      return () => setFavicon(element);
    }
  }, [status]);
};
