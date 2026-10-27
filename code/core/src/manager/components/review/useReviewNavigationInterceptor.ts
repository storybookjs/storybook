import { useEffect } from 'react';

import { useReviewContext } from './review-context.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  REVIEW_SUMMARY_BACK_ATTR,
  buildReviewChangesSummaryHref,
  parseReviewStoryHref,
} from './review-navigation.ts';

const isReviewStoryHref = (href: string) =>
  href.startsWith('?path=/story/') && href.includes(`${REVIEW_COLLECTION_QUERY_PARAM}=`);

const isReviewSummaryHref = (href: string) => href === buildReviewChangesSummaryHref();

/**
 * Intercepts primary clicks on in-page review navigation links for SPA
 * transitions. Real hrefs are preserved for middle-click and open-in-new-tab.
 */
export const useReviewNavigationInterceptor = () => {
  const { openSummary, openEntry, leaveReview } = useReviewContext();

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
      if (!href) {
        return;
      }

      if (anchor?.hasAttribute(REVIEW_SUMMARY_BACK_ATTR)) {
        event.preventDefault();
        leaveReview();
        return;
      }

      if (!isReviewStoryHref(href) && !isReviewSummaryHref(href)) {
        return;
      }
      event.preventDefault();

      if (isReviewSummaryHref(href)) {
        openSummary();
        return;
      }

      const entry = parseReviewStoryHref(href);
      if (!entry) {
        return;
      }
      openEntry(entry);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [openSummary, openEntry, leaveReview]);
};
