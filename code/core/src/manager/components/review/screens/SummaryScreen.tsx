import React, { useEffect, useLayoutEffect, useMemo, useState, type FC } from 'react';

import {
  Button,
  Card,
  Collapsible,
  DocumentWrapper,
  EmptyTabContent,
  IconButton,
  PopoverProvider,
  ScrollArea,
} from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import {
  ChevronSmallDownIcon,
  ChevronSmallLeftIcon,
  CopyIcon,
  SparkleIcon,
  StatusPassIcon,
  StorybookIcon,
} from '@storybook/icons';

import { CollectionGrid, type StoryInfo } from '../components/CollectionGrid.tsx';
import { Markdown } from '../components/Markdown.tsx';
import { CopyButton } from '../components/CopyButton.tsx';
import { STALE_REFRESH_PROMPT } from '../components/AttentionBanner.tsx';
import { ReviewHeader } from '../components/ReviewHeader.tsx';
import {
  REVIEW_SUMMARY_BACK_ATTR,
  buildReviewStoryHref,
  buildSummaryBackHref,
} from '../review-navigation.ts';
import type { ReviewState } from '../review-state.ts';

const MarkdownWrapper = styled(DocumentWrapper)(({ theme }) => ({
  color: theme.color.defaultText,
  p: {
    margin: 0,
  },
  'p + p': {
    marginTop: 10,
  },
  code: {
    color: 'inherit',
    verticalAlign: 'text-bottom',
    fontSize: '0.85em',
    margin: 0,
    padding: '0 4px',
    background: 'transparent',
    border: 'none',
    boxShadow: `inset 0 0 0 1px ${theme.appBorderColor}`,
    borderRadius: theme.appBorderRadius,
  },
}));

// `100dvh` fills the manager's page cell and also works in the addon's own
// fullscreen stories, where #storybook-root has no height. The card list below
// the fixed header is the single scroll container.
const Page = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100dvh',
  minHeight: 0,
  overflow: 'hidden',
  background: theme.background.app,
  color: theme.color.defaultText,
  fontFamily: theme.typography.fonts.base,
  fontSize: theme.typography.size.s2,
}));

// Wrapper that gives the overlay ScrollArea a bounded height to scroll within.
const ListScroll = styled.div({
  flex: 1,
  minHeight: 0,
});

const List = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 12,
  // Cards must keep their intrinsic height so the list scrolls; without this
  // the default flex-shrink collapses them to fit the viewport and Card's
  // overflow:hidden clips the content at the bottom.
  '& > *': {
    flexShrink: 0,
  },
});

const SummaryCard = styled(Card)({
  display: 'flex',
  alignItems: 'flex-start',
  padding: '9px 12px',
  gap: 6,
  svg: {
    flexShrink: 0,
    marginTop: 4,
  },
});

const SummaryContent = styled(MarkdownWrapper)({
  flex: 1,
  minWidth: 0,
});

// A plain clickable row, not a semantic control: making the whole header
// toggle is just a convenience affordance for pointer users. The real
// accessible control is the chevron <IconButton> inside, which carries the
// aria-label and aria-expanded state for assistive technologies.
const CardHead = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '6px 10px 6px 12px',
  minHeight: 40,
  cursor: 'pointer',
});

const CardTitle = styled.strong(({ theme }) => ({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: theme.typography.weight.bold,
  lineHeight: '20px',
  color: theme.color.defaultText,
}));

const CardControls = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 6,
  flexShrink: 0,
});

const CardCount = styled.span(({ theme }) => ({
  minWidth: 28,
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s2 - 1,
  lineHeight: '20px',
  textAlign: 'center',
  color: theme.textMutedColor,
}));

const ToggleChevronIcon = styled(ChevronSmallDownIcon)({
  transition: 'transform 160ms ease',
});

const CardTitleGroup = styled.div({
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
});

const CardRationale = styled(MarkdownWrapper)(({ theme }) => ({
  color: theme.textMutedColor,
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  p: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}));

const StalePopoverContent = styled.div({
  padding: 15,
  width: 280,
  boxSizing: 'border-box',
});

const StalePopoverMessage = styled.div(({ theme }) => ({
  color: theme.color.defaultText,
  lineHeight: '18px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 8,
}));

const StalePopoverTitle = styled.div(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
}));

const StalePrompt = styled.p(({ theme }) => ({
  margin: 0,
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1 - 1,
  padding: '6px 10px',
  background: theme.background.app,
  boxShadow: `inset 0 0 0 1px ${theme.appBorderColor}`,
  borderRadius: theme.appBorderRadius,
}));

const HeaderNoticeText = styled.strong(({ theme }) => ({
  fontSize: theme.typography.size.s1,
  color: theme.color.defaultText,
  whiteSpace: 'nowrap',
  lineHeight: '20px',
  marginLeft: 12,
}));

const Footer = styled.div(({ theme }) => ({
  color: theme.textMutedColor,
  padding: '10px 10px 30px',
  fontSize: theme.typography.size.s2,
  textAlign: 'center',
  textWrap: 'balance',
}));

const formatCreatedAgo = (createdAt: number, nowMs: number): string => {
  const elapsedMs = Math.max(0, nowMs - createdAt);
  if (elapsedMs < 60_000) {
    return 'just now';
  }
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }
  return `${Math.floor(elapsedMinutes / 60)}h ago`;
};

export interface SummaryScreenProps {
  state: ReviewState | null;
  /** Story id → component title + name, resolved from the Storybook index. */
  storyInfo?: Record<string, StoryInfo>;
  /** Builds the (frozen) preview iframe src for a story thumbnail. */
  getStoryPreviewHref: (storyId: string) => string;
  /** When true, render the "this review may be stale" banner at the top. */
  isStale?: boolean;
  /** When true, render the "updated review available" banner at the top. */
  hasPendingUpdate?: boolean;
  /** Accepts the pending review and navigates to the summary screen. */
  onAcceptPendingUpdate?: () => void;
  /** Keep summary preview iframes mounted while the overlay is hidden. */
  previewsPaused?: boolean;
  /** Clears the active review (if any) and returns to the pre-review canvas. */
  onDismiss: () => void;
  /** Pre-review canvas search, or root when none is recorded yet. */
  returnSearch?: string | null;
}

export const SummaryScreen: FC<SummaryScreenProps> = ({
  state,
  storyInfo = {},
  getStoryPreviewHref,
  isStale = false,
  hasPendingUpdate = false,
  onAcceptPendingUpdate,
  previewsPaused = false,
  onDismiss,
  returnSearch = null,
}) => {
  const [expandedCollections, setExpandedCollections] = useState<Set<number>>(() => new Set());
  const [showAllCollections, setShowAllCollections] = useState<Set<number>>(() => new Set());
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, []);

  useLayoutEffect(() => {
    if (!state) {
      setExpandedCollections(new Set());
      setShowAllCollections(new Set());
      return;
    }
    setExpandedCollections(new Set(state.collections.map((_, index) => index)));
    setShowAllCollections(new Set());
  }, [state]);

  // Must be computed before the early return — hooks cannot be called conditionally.
  const newStoryCount = useMemo(
    () =>
      new Set(
        (state?.collections ?? [])
          .flatMap((c) => c.storyIds)
          .filter((id) => storyInfo[id]?.isNewlyAdded)
      ).size,
    [state, storyInfo]
  );

  const visibleCollections = useMemo(
    () =>
      (state?.collections ?? [])
        .map((collection, index) => {
          const storyIds = showNewOnly
            ? collection.storyIds.filter((id) => storyInfo[id]?.isNewlyAdded)
            : collection.storyIds;
          return { collection, index, storyIds };
        })
        .filter((entry) => entry.storyIds.length > 0),
    [state?.collections, showNewOnly, storyInfo]
  );

  if (!state) {
    return (
      <Page>
        <EmptyTabContent
          title="Waiting for the agent…"
          description="Once the agent creates a review, it will appear here."
          footer={
            <Button variant="outline" onClick={onDismiss}>
              Back to Storybook
            </Button>
          }
        />
      </Page>
    );
  }

  const storyCount = new Set(state.collections.flatMap((collection) => collection.storyIds)).size;
  const createdAgo = state.createdAt ? formatCreatedAgo(state.createdAt, nowMs) : null;

  const toggleCollection = (index: number) => {
    setExpandedCollections((previous) => {
      const next = new Set(previous);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };
  const markCollectionShowAll = (index: number) => {
    setShowAllCollections((previous) =>
      previous.has(index) ? previous : new Set(previous).add(index)
    );
  };

  return (
    <Page>
      <ReviewHeader
        leading={
          <Button
            variant="ghost"
            size="small"
            padding="small"
            ariaLabel="Back to Storybook"
            asChild
          >
            <a href={buildSummaryBackHref(returnSearch)} {...{ [REVIEW_SUMMARY_BACK_ATTR]: '' }}>
              <ChevronSmallLeftIcon />
              <StorybookIcon />
            </a>
          </Button>
        }
        title={state.title}
        subtitle={
          <>
            <span>
              Showing {storyCount} {storyCount === 1 ? 'story' : 'stories'} for quick review
            </span>
            {createdAgo ? (
              <>
                <span>&bull;</span>
                <span>{createdAgo}</span>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            {newStoryCount > 0 ? (
              <Button
                variant="ghost"
                size="small"
                padding="small"
                ariaLabel={false}
                tooltip="Toggle filtering of new stories"
                active={showNewOnly}
                onClick={() => setShowNewOnly((v) => !v)}
              >
                {newStoryCount} new
              </Button>
            ) : null}
            {hasPendingUpdate && onAcceptPendingUpdate ? (
              <>
                <HeaderNoticeText>Newer review available</HeaderNoticeText>
                <Button
                  variant="outline"
                  ariaLabel="Refresh review"
                  onClick={onAcceptPendingUpdate}
                >
                  Reload
                </Button>
              </>
            ) : isStale ? (
              <>
                <HeaderNoticeText>Code edits detected</HeaderNoticeText>
                <PopoverProvider
                  ariaLabel="Prompt to refresh stale review"
                  placement="bottom-end"
                  padding={0}
                  popover={
                    <StalePopoverContent>
                      <StalePopoverMessage>
                        <StalePopoverTitle>
                          Prompt for your agent to refresh this review:
                        </StalePopoverTitle>
                        <StalePrompt>{STALE_REFRESH_PROMPT}</StalePrompt>
                        <CopyButton
                          appearance="agentic"
                          padding="small"
                          ariaLabel="Copy prompt to refresh this review"
                          ariaLabelOnCopy="Prompt copied to clipboard"
                          content={STALE_REFRESH_PROMPT}
                          childrenOnCopy={
                            <>
                              <StatusPassIcon /> Copy prompt
                            </>
                          }
                        >
                          <CopyIcon />
                          Copy prompt
                        </CopyButton>
                      </StalePopoverMessage>
                    </StalePopoverContent>
                  }
                >
                  <Button variant="outline" ariaLabel={false}>
                    Prompt agent
                  </Button>
                </PopoverProvider>
              </>
            ) : null}
          </>
        }
      />

      <ListScroll>
        <ScrollArea vertical>
          <List>
            <SummaryCard color="agentic">
              <SparkleIcon />
              <SummaryContent>
                <Markdown>{'**Summary:** ' + state.description}</Markdown>
              </SummaryContent>
            </SummaryCard>
            {visibleCollections.length === 0 ? (
              <Footer>{showNewOnly ? 'No new stories found.' : 'No collections found.'}</Footer>
            ) : (
              visibleCollections.map(({ collection, index, storyIds }) => {
                const isExpanded = expandedCollections.has(index);
                return (
                  <Card key={`${collection.title}-${index}`}>
                    <Collapsible
                      collapsed={!isExpanded}
                      summary={
                        <CardHead onClick={() => toggleCollection(index)}>
                          <CardTitleGroup>
                            <CardTitle>{collection.title}</CardTitle>
                            {collection.rationale ? (
                              <CardRationale>
                                <Markdown>{collection.rationale}</Markdown>
                              </CardRationale>
                            ) : null}
                          </CardTitleGroup>
                          <CardControls>
                            <CardCount>{storyIds.length}</CardCount>
                            <IconButton
                              variant="ghost"
                              size="small"
                              padding="small"
                              ariaLabel={
                                isExpanded
                                  ? `Collapse collection ${collection.title}`
                                  : `Expand collection ${collection.title}`
                              }
                              aria-expanded={isExpanded}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleCollection(index);
                              }}
                            >
                              <ToggleChevronIcon
                                style={{ transform: `rotate(${isExpanded ? -180 : 0}deg)` }}
                              />
                            </IconButton>
                          </CardControls>
                        </CardHead>
                      }
                    >
                      <CollectionGrid
                        storyIds={storyIds}
                        showAll={showAllCollections.has(index)}
                        onShowAll={() => markCollectionShowAll(index)}
                        storyInfo={storyInfo}
                        getStoryHref={(storyId) =>
                          buildReviewStoryHref({ collectionIndex: index, storyId })
                        }
                        getStoryPreviewHref={getStoryPreviewHref}
                        previewsPaused={previewsPaused}
                      />
                    </Collapsible>
                  </Card>
                );
              })
            )}
            <Footer>
              This review shows the {storyCount} {storyCount === 1 ? 'story' : 'stories'} most
              relevant for you to spot-check right now. Because this is AI-curated, results may be
              inaccurate or incomplete.
            </Footer>
          </List>
        </ScrollArea>
      </ListScroll>
    </Page>
  );
};
