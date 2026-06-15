import { useEffect } from 'react';

import { useNavigate } from 'storybook/internal/router';
import { useStorybookApi, useStorybookState } from 'storybook/manager-api';
import type { StatusValue } from 'storybook/internal/types';

import { REVIEW_CHANGES_URL } from './constants.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  REVIEW_SUMMARY_BACK_ATTR,
  STORYBOOK_ROOT_HREF,
  buildReviewChangesSummaryHref,
  buildReviewStoryNavigationTarget,
  parseReviewStoryHref,
} from './review-navigation.ts';
import { openReviewSidebar } from './review-sidebar.ts';
import { clearReviewingStatusFilter } from './review-status-filters.ts';
import { reviewStore } from './review-store.ts';

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
  const {
    includedStatusFilters: rawIncludedStatusFilters,
    excludedStatusFilters: rawExcludedStatusFilters,
  } = useStorybookState();

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
        reviewStore.suppressSummaryOverlay();
        reviewStore.releaseSummaryOverlaySuppression();
        api.setQueryParams({ [REVIEW_COLLECTION_QUERY_PARAM]: null });
        void clearReviewingStatusFilter(
          api,
          (rawIncludedStatusFilters ?? []) as StatusValue[],
          (rawExcludedStatusFilters ?? []) as StatusValue[]
        );
        openReviewSidebar(api);
        if (href === STORYBOOK_ROOT_HREF || href === '/?') {
          navigate(STORYBOOK_ROOT_HREF);
          return;
        }
        navigate(href.startsWith('?') ? href : `?${href}`, { plain: true });
        return;
      }

      if (!isReviewStoryHref(href) && !isReviewSummaryHref(href)) {
        return;
      }
      event.preventDefault();

      if (isReviewSummaryHref(href)) {
        api.setQueryParams({ [REVIEW_COLLECTION_QUERY_PARAM]: null });
        navigate(REVIEW_CHANGES_URL);
        return;
      }

      const entry = parseReviewStoryHref(href);
      if (!entry) {
        return;
      }

      reviewStore.suppressSummaryOverlay();
      api.setQueryParams({
        [REVIEW_COLLECTION_QUERY_PARAM]: String(entry.collectionIndex),
      });
      navigate(buildReviewStoryNavigationTarget(entry));
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [api, navigate, rawExcludedStatusFilters, rawIncludedStatusFilters]);
};
