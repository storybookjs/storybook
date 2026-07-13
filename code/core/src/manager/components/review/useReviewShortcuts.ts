import { useCallback, useEffect, useRef } from 'react';

import { useNavigate } from 'storybook/internal/router';
import { useStorybookApi } from 'storybook/manager-api';

import { ADDON_ID } from './constants.ts';
import { navigateToReviewEntry, navigateToReviewSummary } from './review-actions.ts';
import {
  buildReviewShortcutHrefs,
  parseReviewStoryHref,
  type ReviewShortcutHrefs,
} from './review-navigation.ts';
import { useReview } from './review-store.ts';
import { useReviewFiltersRef } from './useReviewFiltersRef.ts';

/**
 * Register review navigation as customizable addon shortcuts and keep their
 * targets in sync with the active reviewed story.
 */
export const useReviewShortcuts = () => {
  const api = useStorybookApi();
  const navigate = useNavigate();
  const { state, flattenedEntries, activeEntry, activeIndex } = useReview();
  const shortcutHrefsRef = useRef<ReviewShortcutHrefs | null>(null);
  const filtersRef = useReviewFiltersRef();

  const navigateToShortcut = useCallback(
    (target: keyof ReviewShortcutHrefs) => {
      const hrefs = shortcutHrefsRef.current;
      if (!hrefs) {
        return;
      }

      if (target === 'back') {
        navigateToReviewSummary(api, navigate, filtersRef.current);
        return;
      }

      const entry = parseReviewStoryHref(hrefs[target]);
      if (!entry) {
        return;
      }
      navigateToReviewEntry(api, navigate, entry, filtersRef.current);
    },
    [api, navigate, filtersRef]
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

  // Bare arrows/escape must only apply while a reviewed story is active, or they'd swallow
  // the keys the sidebar tree (react-aria) and overlays rely on everywhere else.
  const isReviewNavigationActive = useCallback(() => shortcutHrefsRef.current !== null, []);

  useEffect(() => {
    api.setAddonShortcut(ADDON_ID, {
      label: 'Review: back to overview',
      defaultShortcut: ['escape'],
      actionName: 'reviewBack',
      isActive: isReviewNavigationActive,
      action: () => navigateToShortcut('back'),
    });
    api.setAddonShortcut(ADDON_ID, {
      label: 'Review: previous story',
      defaultShortcut: ['ArrowLeft'],
      actionName: 'reviewPreviousStory',
      isActive: isReviewNavigationActive,
      action: () => navigateToShortcut('previous'),
    });
    api.setAddonShortcut(ADDON_ID, {
      label: 'Review: next story',
      defaultShortcut: ['ArrowRight'],
      actionName: 'reviewNextStory',
      isActive: isReviewNavigationActive,
      action: () => navigateToShortcut('next'),
    });
    api.setAddonShortcut(ADDON_ID, {
      label: 'Review: previous collection',
      defaultShortcut: ['ArrowUp'],
      actionName: 'reviewPreviousCollection',
      isActive: isReviewNavigationActive,
      action: () => navigateToShortcut('previousCollection'),
    });
    api.setAddonShortcut(ADDON_ID, {
      label: 'Review: next collection',
      defaultShortcut: ['ArrowDown'],
      actionName: 'reviewNextCollection',
      isActive: isReviewNavigationActive,
      action: () => navigateToShortcut('nextCollection'),
    });
  }, [api, navigateToShortcut, isReviewNavigationActive]);
};
