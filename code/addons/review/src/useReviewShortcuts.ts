import { useCallback, useEffect, useRef } from 'react';

import { useNavigate } from 'storybook/internal/router';
import { type ReviewModeFilters, useStorybookApi, useStorybookState } from 'storybook/manager-api';
import type { StatusValue } from 'storybook/internal/types';

import { ADDON_ID } from './constants.ts';
import { navigateToReviewEntry, navigateToReviewSummary } from './review-actions.ts';
import {
  buildReviewShortcutHrefs,
  parseReviewStoryHref,
  type ReviewShortcutHrefs,
} from './review-navigation.ts';
import { useReview } from './review-store.ts';

/**
 * Register review navigation as customizable addon shortcuts and keep their
 * targets in sync with the active reviewed story.
 */
export const useReviewShortcuts = () => {
  const api = useStorybookApi();
  const navigate = useNavigate();
  const { state, flattenedEntries, activeEntry, activeIndex } = useReview();
  const { includedStatusFilters, excludedStatusFilters, includedTagFilters, excludedTagFilters } =
    useStorybookState();
  const shortcutHrefsRef = useRef<ReviewShortcutHrefs | null>(null);

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
