import React, { useEffect, type FC, type ReactNode } from 'react';

import { Select } from 'storybook/internal/components';

import { useNavigate } from 'storybook/internal/router';
import { useStorybookApi } from 'storybook/manager-api';

import { navigateToReviewEntry } from '../review-actions.ts';
import { prettifyComponentId, resolveNavIndex, type ReviewNavEntry } from '../review-navigation.ts';
import { type StoryInfo } from '../review-types.ts';
import { useReviewFiltersRef } from '../useReviewFiltersRef.ts';

const derivePickerLabel = (
  storyId: string,
  info?: StoryInfo
): { component: string; story: string } => {
  if (info) {
    return { component: info.title.split('/').pop() ?? info.title, story: info.name };
  }
  const [componentId, ...rest] = storyId.split('--');
  return {
    component: prettifyComponentId(componentId),
    story: prettifyComponentId(rest.join('--')) || 'Story',
  };
};

export interface ReviewCollectionPickerProps {
  /** Every reviewable story, in navigation order. */
  entries: ReviewNavEntry[];
  /** The story currently open in the review. */
  activeEntry: ReviewNavEntry;
  /** Story id → resolved component title + name, for the option labels. */
  storyInfo: Record<string, StoryInfo>;
  /** Trigger content, e.g. the "current / total" counter. */
  children: ReactNode;
}

/**
 * Story navigator for the review toolbar. A thin wrapper around the design-system
 * {@link Select}: the trigger renders the caller-provided counter, and the listbox
 * lets the user jump to any story in the review. Choosing an option navigates to
 * that story.
 */
export const ReviewCollectionPicker: FC<ReviewCollectionPickerProps> = ({
  entries,
  activeEntry,
  storyInfo,
  children,
}) => {
  const api = useStorybookApi();
  const navigate = useNavigate();
  const filtersRef = useReviewFiltersRef();

  // Each option carries the entry's index in `entries` as its value. A story can
  // appear under several collections, so its storyId is not unique — the index is,
  // which lets us resolve the exact selected slot (not just the first duplicate).
  const options = entries.map((entry, index) => {
    const { component, story } = derivePickerLabel(entry.storyId, storyInfo[entry.storyId]);
    return { value: index, title: component, description: story };
  });

  // Preselect the active slot without driving navigation: `resolveNavIndex` matches
  // both storyId and collectionIndex, so the picker highlights the correct duplicate.
  const activeValue = resolveNavIndex(entries, activeEntry);

  // Creates a buffer that helps batch useEffects on quick switch and limit performance issues in the listbox.
  // Starts undefined so the navigation effect only fires after an explicit user selection, never on mount.
  const [nextStory, setNextStory] = React.useState<ReviewNavEntry | undefined>(undefined);

  useEffect(() => {
    if (nextStory) {
      navigateToReviewEntry(api, navigate, nextStory, filtersRef.current);
    }
  }, [nextStory, api, navigate, filtersRef]);

  return (
    <Select
      ariaLabel="Select story"
      size="small"
      padding="small"
      options={options}
      defaultOptions={activeValue >= 0 ? activeValue : undefined}
      showSelectedOptionTitle={false}
      onSelect={(value) => {
        const entry = typeof value === 'number' ? entries[value] : undefined;
        setNextStory(entry);
      }}
    >
      {children}
    </Select>
  );
};
