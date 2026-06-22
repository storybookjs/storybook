import React, { type FC } from 'react';

import { Badge, Button, Popover, WithTooltip } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import { ChevronSmallLeftIcon, ChevronSmallRightIcon, WandIcon } from '@storybook/icons';

import { ReviewCollectionPicker } from './ReviewCollectionPicker.tsx';
import { ReviewHeader } from './components/ReviewHeader.tsx';
import { AttentionBanner } from './components/AttentionBanner.tsx';
import {
  buildReviewChangesSummaryHref,
  buildReviewStoryHref,
  getAdjacentReviewEntries,
} from './review-navigation.ts';
import { countReviewed, reviewEntryKey } from './review-progress.ts';
import { useReview } from './review-store.ts';

const Root = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  width: '100%',
  background: theme.background.content,
  zIndex: 4,
}));

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
  background: theme.background.app,
}));

const ProgressFill = styled.div(({ theme }) => ({
  position: 'absolute',
  insetBlock: 0,
  left: 0,
  background: theme.color.secondary,
  transition: 'width 200ms ease',
}));

const SubtitleStrong = styled.span(({ theme }) => ({
  fontWeight: 700,
  color: theme.color.defaultText,
}));

const SubtitleSeparator = styled.span(({ theme }) => ({
  color: theme.color.defaultText,
}));

const SubtitleText = styled.span(({ theme }) => ({
  color: theme.color.defaultText,
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
    hasPendingUpdate,
    onAcceptPendingUpdate,
    storyInfo,
    flattenedEntries,
    newlyAddedStoryIds,
    activeEntry,
    activeIndex,
    reviewedStoryIds,
    justCompletedEntryKey,
  } = useReview();

  if (!state || !activeEntry || activeIndex < 0) {
    return null;
  }

  const collection = state.collections[activeEntry.collectionIndex];
  const collectionTitle = collection?.title ?? 'Review';
  const totalStories = flattenedEntries.length;
  const neighbors = getAdjacentReviewEntries(flattenedEntries, activeIndex);
  const previousEntry = neighbors?.previous ?? activeEntry;
  const nextEntry = neighbors?.next ?? activeEntry;
  const progress = totalStories > 1 ? activeIndex / (totalStories - 1) : 0;
  const currentStoryInfo = storyInfo[activeEntry.storyId];
  const isNewlyAdded = newlyAddedStoryIds.has(activeEntry.storyId);

  // Forward control state machine (first match wins). The current story always
  // counts as reviewed: it is marked on arrival, but this guards the render frame
  // before that effect commits.
  const uniqueStoryIds = new Set(flattenedEntries.map((entry) => entry.storyId));
  const reviewedWithCurrent = reviewedStoryIds.has(activeEntry.storyId)
    ? reviewedStoryIds
    : new Set(reviewedStoryIds).add(activeEntry.storyId);
  const allReviewed = countReviewed(reviewedWithCurrent, uniqueStoryIds) >= uniqueStoryIds.size;
  const isLastEntry = activeIndex === flattenedEntries.length - 1;
  const justCompleted = justCompletedEntryKey === reviewEntryKey(activeEntry);
  const showDone = isLastEntry || justCompleted;

  const metadataSubtitle =
    currentStoryInfo?.title && currentStoryInfo.name ? (
      <>
        <SubtitleStrong>{componentName(currentStoryInfo.title)}</SubtitleStrong>
        <SubtitleSeparator>/</SubtitleSeparator>
        <SubtitleText>{currentStoryInfo.name}</SubtitleText>
      </>
    ) : null;

  const subtitle =
    metadataSubtitle || isNewlyAdded ? (
      <>
        {metadataSubtitle}
        {isNewlyAdded ? <Badge status="positive">New</Badge> : null}
      </>
    ) : undefined;

  const counter =
    totalStories > 0 ? (
      <WithTooltip
        trigger="click"
        closeOnOutsideClick
        placement="bottom"
        tooltip={({ onHide }) => (
          <Popover hasChrome padding={0}>
            <ReviewCollectionPicker
              entries={flattenedEntries}
              storyInfo={storyInfo}
              activeEntry={activeEntry}
              onClose={onHide}
            />
          </Popover>
        )}
      >
        <Counter variant="ghost" size="small" ariaLabel="Open story list">
          {activeIndex + 1}/{totalStories}
        </Counter>
      </WithTooltip>
    ) : (
      <Counter variant="ghost" size="small" ariaLabel={false} readOnly>
        {activeIndex + 1}/{totalStories}
      </Counter>
    );

  return (
    <Root data-testid="review-toolbar-header">
      {hasPendingUpdate ? (
        <AttentionBanner kind="pending-update" onAccept={onAcceptPendingUpdate} />
      ) : isStale ? (
        <AttentionBanner kind="stale" />
      ) : null}
      <HeaderWrap>
        <ProgressBar
          role="progressbar"
          aria-label="Review progress"
          aria-valuenow={activeIndex + 1}
          aria-valuemin={1}
          aria-valuemax={totalStories}
          data-testid="review-progress"
        >
          <ProgressFill
            data-testid="review-progress-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </ProgressBar>
        <ReviewHeader
          variant="toolbar"
          leading={
            <Button variant="ghost" size="small" padding="small" ariaLabel="Back to review" asChild>
              <a href={buildReviewChangesSummaryHref()}>
                <ChevronSmallLeftIcon />
                <WandIcon />
              </a>
            </Button>
          }
          title={collectionTitle}
          subtitle={subtitle}
          actions={
            <>
              {counter}
              <Button
                variant="ghost"
                size="small"
                padding="small"
                ariaLabel="Previous story"
                asChild
              >
                <a href={buildReviewStoryHref(previousEntry)}>
                  <ChevronSmallLeftIcon />
                </a>
              </Button>
              {showDone ? (
                <Button variant="solid" size="small" padding="small" ariaLabel={false} asChild>
                  <a href={buildReviewChangesSummaryHref()}>Done</a>
                </Button>
              ) : !allReviewed ? (
                <Button variant="solid" size="small" padding="small" ariaLabel={false} asChild>
                  <a href={buildReviewStoryHref(nextEntry)}>Next</a>
                </Button>
              ) : (
                <Button variant="ghost" size="small" padding="small" ariaLabel="Next story" asChild>
                  <a href={buildReviewStoryHref(nextEntry)}>
                    <ChevronSmallRightIcon />
                  </a>
                </Button>
              )}
            </>
          }
        />
      </HeaderWrap>
    </Root>
  );
};
