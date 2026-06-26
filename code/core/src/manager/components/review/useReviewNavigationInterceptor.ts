import { useEffect } from 'react';

import { useNavigate } from 'storybook/internal/router';
import { useStorybookApi } from 'storybook/manager-api';

import { PRE_REVIEW_RETURN_KEY } from './constants.ts';
import {
  navigateOutOfReview,
  navigateToReviewEntry,
  navigateToReviewSummary,
} from './review-actions.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  REVIEW_SUMMARY_BACK_ATTR,
  isReviewSummaryPath,
  parseReviewStoryHref,
} from './review-navigation.ts';
import { sessionStore } from './session-store.ts';
import { useReviewFiltersRef } from './useReviewFiltersRef.ts';

const parseHrefPath = (href: string): string | null => {
  const query = href.startsWith('?') ? href.slice(1) : href;
  return new URLSearchParams(query).get('path');
};

const isReviewStoryHref = (href: string) => {
  const path = parseHrefPath(href);
  if (!path?.startsWith('/story/')) {
    return false;
  }
  const query = href.startsWith('?') ? href.slice(1) : href;
  return new URLSearchParams(query).has(REVIEW_COLLECTION_QUERY_PARAM);
};

const isReviewSummaryHref = (href: string) => {
  const path = parseHrefPath(href);
  return path !== null && isReviewSummaryPath(path);
};

/**
 * Intercepts primary clicks on in-page review navigation links for SPA
 * transitions. Real hrefs are preserved for middle-click and open-in-new-tab.
 */
export const useReviewNavigationInterceptor = () => {
  const navigate = useNavigate();
  const api = useStorybookApi();
  const filtersRef = useReviewFiltersRef();

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
        navigateOutOfReview(api, navigate, sessionStore.read(PRE_REVIEW_RETURN_KEY));
        return;
      }

      if (!isReviewStoryHref(href) && !isReviewSummaryHref(href)) {
        return;
      }
      event.preventDefault();

      if (isReviewSummaryHref(href)) {
        navigateToReviewSummary(api, navigate, filtersRef.current);
        return;
      }

      const entry = parseReviewStoryHref(href);
      if (!entry) {
        return;
      }
      navigateToReviewEntry(api, navigate, entry, filtersRef.current);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [api, navigate, filtersRef]);
};
