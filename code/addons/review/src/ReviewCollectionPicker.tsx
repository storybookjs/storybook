import React, { useEffect, useRef, type FC } from 'react';

import { styled } from 'storybook/theming';

import { type StoryInfo } from './components/CollectionGrid.tsx';
import {
  buildReviewStoryHref,
  prettifyComponentId,
  type ReviewNavEntry,
} from './review-navigation.ts';

const PopoverList = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  padding: '4px 0',
  minWidth: 280,
  maxHeight: '60vh',
  overflowY: 'auto',
  fontFamily: theme.typography.fonts.base,
}));

const PopoverItem = styled.a<{ $active: boolean }>(({ theme, $active }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 10px',
  background: $active ? theme.background.hoverable : 'transparent',
  textDecoration: 'none',
  color: theme.color.defaultText,
  '&:hover': { background: theme.background.hoverable },
  '&:focus-visible': {
    outline: `2px solid ${theme.color.secondary}`,
    outlineOffset: -2,
  },
}));

const PopoverItemText = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
});

const PopoverItemComponent = styled.span(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
  fontSize: theme.typography.size.s2,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flexShrink: 0,
  maxWidth: '55%',
}));

const PopoverItemSep = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
  flexShrink: 0,
}));

const PopoverItemStoryName = styled.span(({ theme }) => ({
  fontSize: theme.typography.size.s2,
  color: theme.textMutedColor,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));

const derivePopoverLabel = (
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
  entries: ReviewNavEntry[];
  storyInfo: Record<string, StoryInfo>;
  activeEntry: ReviewNavEntry;
  onClose: () => void;
}

export const ReviewCollectionPicker: FC<ReviewCollectionPickerProps> = ({
  entries,
  storyInfo,
  activeEntry,
  onClose,
}) => {
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  return (
    <PopoverList role="list" aria-label="Stories in this review">
      {entries.map((entry, index) => {
        const { component, story } = derivePopoverLabel(entry.storyId, storyInfo[entry.storyId]);
        const href = buildReviewStoryHref(entry);
        const isActive =
          entry.storyId === activeEntry.storyId &&
          entry.collectionIndex === activeEntry.collectionIndex;
        return (
          <PopoverItem
            key={`${entry.collectionIndex}-${entry.storyId}-${index}`}
            $active={isActive}
            ref={isActive ? activeRef : undefined}
            href={href}
            onClick={onClose}
          >
            <PopoverItemText>
              <PopoverItemComponent>{component}</PopoverItemComponent>
              <PopoverItemSep>/</PopoverItemSep>
              <PopoverItemStoryName>{story}</PopoverItemStoryName>
            </PopoverItemText>
          </PopoverItem>
        );
      })}
    </PopoverList>
  );
};
