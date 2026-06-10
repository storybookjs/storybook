import React, { type FC } from 'react';

import { Badge, Button, IconButton } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import { ChevronSmallLeftIcon, ChevronSmallRightIcon } from '@storybook/icons';

import { ReviewHeader } from './components/ReviewHeader.tsx';
import { StaleBanner } from './components/StaleBanner.tsx';
import {
  buildReviewChangesSummaryHref,
  buildReviewStoryHref,
  getReviewDetailNeighbors,
} from './review-navigation.ts';
import { useReview } from './review-store.ts';

const Root = styled.div({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  width: '100%',
});

const HeaderWrap = styled.div({
  position: 'relative',
  flexShrink: 0,
});

const ProgressBar = styled.div(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  zIndex: 1,
  width: '100%',
  height: 3,
  overflow: 'hidden',
  background: theme.background.hoverable,
}));

const ProgressFill = styled.div(({ theme }) => ({
  position: 'absolute',
  insetBlock: 0,
  left: 0,
  background: theme.color.secondary,
  transition: 'width 200ms ease',
}));

const SubtitleStrong = styled.span({
  fontWeight: 700,
});

const SubtitleSeparator = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
}));

const Counter = styled(Button)(({ theme }) => ({
  fontVariantNumeric: 'tabular-nums',
  fontFamily: theme.typography.fonts.mono,
  fontWeight: theme.typography.weight.regular,
}));

const componentName = (componentTitle: string): string =>
  componentTitle
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .pop() ?? componentTitle;

export const ReviewToolbarHeader: FC = () => {
  const {
    state,
    isStale,
    storyInfo,
    flattenedEntries,
    newlyAddedStoryIds,
    activeEntry,
    activeIndex,
  } = useReview();

  if (!state || !activeEntry || activeIndex < 0) {
    return null;
  }

  const collection = state.collections[activeEntry.collectionIndex];
  const collectionTitle = collection?.title ?? 'Review';
  const totalStories = flattenedEntries.length;
  const neighbors = getReviewDetailNeighbors(flattenedEntries, activeIndex);
  const previousEntry = neighbors?.previous ?? activeEntry;
  const nextEntry = neighbors?.next ?? activeEntry;
  const progress = totalStories > 1 ? activeIndex / (totalStories - 1) : 0;
  const currentStoryInfo = storyInfo[activeEntry.storyId];
  const isNewlyAdded = newlyAddedStoryIds.has(activeEntry.storyId);

  const metadataSubtitle =
    currentStoryInfo?.title && currentStoryInfo.name ? (
      <>
        <SubtitleStrong>{componentName(currentStoryInfo.title)}</SubtitleStrong>
        <SubtitleSeparator>/</SubtitleSeparator>
        <span>{currentStoryInfo.name}</span>
      </>
    ) : null;

  const subtitle =
    metadataSubtitle || isNewlyAdded ? (
      <>
        {metadataSubtitle}
        {isNewlyAdded ? <Badge status="positive">New</Badge> : null}
      </>
    ) : undefined;

  return (
    <Root data-testid="review-toolbar-header">
      {isStale ? <StaleBanner /> : null}
      <HeaderWrap>
        <ProgressBar aria-hidden data-testid="review-progress">
          <ProgressFill
            data-testid="review-progress-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </ProgressBar>
        <ReviewHeader
          variant="toolbar"
          leading={
            <IconButton
              variant="ghost"
              size="small"
              padding="small"
              ariaLabel="Back to review"
              asChild
            >
              <a href={buildReviewChangesSummaryHref()}>
                <ChevronSmallLeftIcon />
              </a>
            </IconButton>
          }
          title={collectionTitle}
          subtitle={subtitle}
          actions={
            <>
              <Counter variant="ghost" size="small" readOnly>
                {activeIndex + 1}/{totalStories}
              </Counter>
              <IconButton
                variant="ghost"
                size="small"
                padding="small"
                ariaLabel="Previous story"
                asChild
              >
                <a href={buildReviewStoryHref(previousEntry)}>
                  <ChevronSmallLeftIcon />
                </a>
              </IconButton>
              <IconButton
                variant="ghost"
                size="small"
                padding="small"
                ariaLabel="Next story"
                asChild
              >
                <a href={buildReviewStoryHref(nextEntry)}>
                  <ChevronSmallRightIcon />
                </a>
              </IconButton>
            </>
          }
        />
      </HeaderWrap>
    </Root>
  );
};
