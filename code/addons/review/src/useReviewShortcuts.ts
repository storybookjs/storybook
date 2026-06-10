import { useCallback, useEffect, useRef } from 'react';

import { useNavigate } from 'storybook/internal/router';
import { useStorybookApi } from 'storybook/manager-api';

import { ADDON_ID, REVIEW_CHANGES_URL } from './constants.ts';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  buildReviewShortcutHrefs,
  buildReviewStoryNavigationTarget,
  parseReviewStoryHref,
  type ReviewShortcutHrefs,
} from './review-navigation.ts';
import { reviewStore, useReview } from './review-store.ts';

/**
 * Register review navigation as customizable addon shortcuts and keep their
 * targets in sync with the active reviewed story.
 */
export const useReviewShortcuts = () => {
  const api = useStorybookApi();
  const navigate = useNavigate();
  const { state, flattenedEntries, activeEntry, activeIndex } = useReview();
  const shortcutHrefsRef = useRef<ReviewShortcutHrefs | null>(null);

  const navigateToShortcut = useCallback(
    (target: keyof ReviewShortcutHrefs) => {
      const hrefs = shortcutHrefsRef.current;
      if (!hrefs) {
        return;
      }

      if (target === 'back') {
        api.setQueryParams({ [REVIEW_COLLECTION_QUERY_PARAM]: null });
        navigate(REVIEW_CHANGES_URL);
        return;
      }

      const entry = parseReviewStoryHref(hrefs[target]);
      if (!entry) {
        return;
      }

      reviewStore.suppressSummaryOverlay();
      api.setQueryParams({
        [REVIEW_COLLECTION_QUERY_PARAM]: String(entry.collectionIndex),
      });
      navigate(buildReviewStoryNavigationTarget(entry));
    },
    [api, navigate]
  );

  useEffect(() => {
    if (state && activeEntry && activeIndex >= 0) {
      shortcutHrefsRef.current = buildReviewShortcutHrefs(
        state.collections,
        flattenedEntries,
        activeIndex
      );
    } else {
      shortcutHrefsRef.current = null;
    }
  }, [state, activeEntry, activeIndex, flattenedEntries]);

  useEffect(() => {
    api.setAddonShortcut(ADDON_ID, {
      label: 'Review: back to overview',
      defaultShortcut: ['escape'],
      actionName: 'reviewBack',
      action: () => navigateToShortcut('back'),
    });
    api.setAddonShortcut(ADDON_ID, {
      label: 'Review: previous story',
      defaultShortcut: ['ArrowLeft'],
      actionName: 'reviewPreviousStory',
      action: () => navigateToShortcut('previous'),
    });
    api.setAddonShortcut(ADDON_ID, {
      label: 'Review: next story',
      defaultShortcut: ['ArrowRight'],
      actionName: 'reviewNextStory',
      action: () => navigateToShortcut('next'),
    });
    api.setAddonShortcut(ADDON_ID, {
      label: 'Review: previous collection',
      defaultShortcut: ['ArrowUp'],
      actionName: 'reviewPreviousCollection',
      action: () => navigateToShortcut('previousCollection'),
    });
    api.setAddonShortcut(ADDON_ID, {
      label: 'Review: next collection',
      defaultShortcut: ['ArrowDown'],
      actionName: 'reviewNextCollection',
      action: () => navigateToShortcut('nextCollection'),
    });
  }, [api, navigateToShortcut]);
};
