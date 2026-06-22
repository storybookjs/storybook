import { useEffect, useRef } from 'react';

import { useNavigate } from 'storybook/internal/router';
import { type ReviewModeFilters, useStorybookApi, useStorybookState } from 'storybook/manager-api';
import type { StatusValue } from 'storybook/internal/types';

import { PRE_REVIEW_RETURN_KEY } from './constants.ts';
import {
  navigateOutOfReview,
  navigateToReviewEntry,
  navigateToReviewSummary,
} from './review-actions.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  REVIEW_SUMMARY_BACK_ATTR,
  buildReviewChangesSummaryHref,
  parseReviewStoryHref,
} from './review-navigation.ts';
import { sessionStore } from './session-store.ts';

const isReviewStoryHref = (href: string) =>
  href.startsWith('?path=/story/') && href.includes(`${REVIEW_COLLECTION_QUERY_PARAM}=`);

const isReviewSummaryHref = (href: string) => href === buildReviewChangesSummaryHref();

/**
 * Intercepts primary clicks on in-page review navigation links for SPA
 * transitions. Real hrefs are preserved for middle-click and open-in-new-tab.
 */
export const useReviewNavigationInterceptor = () => {
  const navigate = useNavigate();
  const api = useStorybookApi();
  const { includedStatusFilters, excludedStatusFilters, includedTagFilters, excludedTagFilters } =
    useStorybookState();

  // Keep the latest filters available to the click handler without re-binding it.
  const filtersRef = useRef<ReviewModeFilters>({
    includedStatusFilters: [],
    excludedStatusFilters: [],
    includedTagFilters: [],
    excludedTagFilters: [],
  });
  filtersRef.current = {
    includedStatusFilters: (includedStatusFilters ?? []) as StatusValue[],
    excludedStatusFilters: (excludedStatusFilters ?? []) as StatusValue[],
    includedTagFilters: includedTagFilters ?? [],
    excludedTagFilters: excludedTagFilters ?? [],
  };

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
  }, [api, navigate]);
};
