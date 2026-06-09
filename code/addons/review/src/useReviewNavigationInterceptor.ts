import { useEffect } from 'react';

import { useNavigate } from 'storybook/internal/router';

import { REVIEW_COLLECTION_QUERY_PARAM } from './review-navigation.ts';
import { buildReviewChangesSummaryHref } from './review-navigation.ts';

const isReviewStoryHref = (href: string) =>
  href.startsWith('?path=/story/') && href.includes(`${REVIEW_COLLECTION_QUERY_PARAM}=`);

const isReviewSummaryHref = (href: string) => href === buildReviewChangesSummaryHref();

/**
 * Intercepts primary clicks on in-page review navigation links for SPA
 * transitions. Real hrefs are preserved for middle-click and open-in-new-tab.
 */
export const useReviewNavigationInterceptor = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const { target } = event;
      const anchor = target instanceof Element ? target.closest('a') : null;
      const href = anchor?.getAttribute('href');
      if (!href || (!isReviewStoryHref(href) && !isReviewSummaryHref(href))) {
        return;
      }
      event.preventDefault();
      navigate(href, { plain: true });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [navigate]);
};
