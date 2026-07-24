import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react';

import {
  Button,
  Card,
  Collapsible,
  DocumentWrapper,
  IconButton,
  ScrollArea,
  ToggleButton,
} from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import {
  CheckIcon,
  ChevronSmallDownIcon,
  ChevronSmallLeftIcon,
  CloseIcon,
  CopyIcon,
  StorybookIcon,
  WandIcon,
} from '@storybook/icons';

import { useLandmark } from '../../../hooks/useLandmark.ts';
import { AttentionBanner } from '../components/AttentionBanner.tsx';
import { CollectionGrid } from '../components/CollectionGrid.tsx';
import { CopyButton } from '../components/CopyButton.tsx';
import { Markdown } from '../components/Markdown.tsx';
import { ReviewHeader } from '../components/ReviewHeader.tsx';
import {
  REVIEW_SUMMARY_BACK_ATTR,
  buildReviewStoryHref,
  buildSummaryBackHref,
} from '../review-navigation.ts';
import type { ReviewState } from '../review-state.ts';
import type { ReviewBanner } from '../review-store.ts';
import type { StoryInfo } from '../review-types.ts';

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

const Empty = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  alignItems: 'center',
  justifyContent: 'center',
  height: '100dvh',
  color: theme.color.defaultText,
  '& > div': {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
}));

// Wrapper that gives the overlay ScrollArea a bounded height to scroll within.
const ListScroll = styled.div({
  flex: 1,
  minHeight: 0,
});

const Main = styled.main({
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
  gap: 10,
  svg: {
    flexShrink: 0,
    marginTop: 4,
  },
});

const SummaryLandmark: FC<{ children: ReactNode }> = ({ children }) => {
  const asideRef = useRef<HTMLElement>(null);
  const { landmarkProps } = useLandmark(
    { role: 'complementary', 'aria-label': 'Summary' },
    asideRef
  );
  return (
    <aside ref={asideRef} {...landmarkProps}>
      {children}
    </aside>
  );
};

const SummaryContent = styled(MarkdownWrapper)({
  flex: 1,
  minWidth: 0,
  // Keep the "Summary:" heading and the first description paragraph on the same
  // line, matching the previous inline "**Summary:** …" rendering.
  '& > p:first-of-type': {
    display: 'inline',
  },
});

// A real heading for the summary label, styled to look identical to the inline
// bold "Summary:" text it replaces.
const SummaryHeading = styled.h2(({ theme }) => ({
  // Double the ampersand to outrank the DocumentWrapper's `.wrapper h2` rule
  // (specificity 0,1,1), which would otherwise enlarge this and add a bottom
  // border, so the label stays identical to the inline bold it replaces.
  '&&': {
    display: 'inline',
    margin: 0,
    padding: 0,
    fontSize: 'inherit',
    fontWeight: theme.typography.weight.bold,
    lineHeight: 'inherit',
    color: 'inherit',
    border: 'none',
  },
}));

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

const CardTitle = styled.h2(({ theme }) => ({
  minWidth: 0,
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 'inherit',
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

const CardRationale = styled(MarkdownWrapper)(({ theme }) => ({
  color: theme.textMutedColor,
  margin: '0 12px',
}));

const Footer = styled.div(({ theme }) => ({
  color: theme.textMutedColor,
  padding: '10px 10px 30px',
  fontSize: theme.typography.size.s2,
  textAlign: 'center',
  textWrap: 'balance',
}));

const CollectionLandmark: FC<{ titleId: string; children: ReactNode }> = ({
  titleId,
  children,
}) => {
  const regionRef = useRef<HTMLElement>(null);
  const { landmarkProps } = useLandmark({ role: 'region', 'aria-labelledby': titleId }, regionRef);
  return (
    <section ref={regionRef} {...landmarkProps}>
      {children}
    </section>
  );
};

// A `contentinfo` landmark must stay top-level, but this footer sits inside the
// `main` landmark, so it is exposed as a named `region` instead. It renders as a
// `section` because `region` is not an allowed role on `footer` (aria-allowed-role),
// and a `<footer>` nested in `<main>` has no implicit `contentinfo` role anyway.
const FooterLandmark: FC<{ children: ReactNode }> = ({ children }) => {
  const regionRef = useRef<HTMLDivElement>(null);
  const { landmarkProps } = useLandmark(
    { role: 'region', 'aria-label': 'About this review' },
    regionRef
  );
  return (
    <Footer as="section" ref={regionRef} {...landmarkProps}>
      {children}
    </Footer>
  );
};

const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : plural}`;

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
  /** Attention banner to render at the top (pending-update or stale). */
  banner?: ReviewBanner;
  /** Keep summary preview iframes mounted while the overlay is hidden. */
  summaryHidden?: boolean;
  /** Clears the active review (if any) and returns to the pre-review canvas. */
  onDismiss: () => void;
  /** Pre-review canvas search, or root when none is recorded yet. */
  returnSearch?: string | null;
}

export const SummaryScreen: FC<SummaryScreenProps> = ({
  state,
  storyInfo = {},
  getStoryPreviewHref,
  banner = null,
  summaryHidden = false,
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
  }, [state?.createdAt]);

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
      <Empty>
        <span>Waiting for the agent to display a review…</span>
        <div>
          <CopyButton
            appearance="agentic"
            padding="small"
            ariaLabel="Copy prompt to refresh this review"
            ariaLabelOnCopy="Prompt copied to clipboard"
            content="Generate a Storybook review including my latest changes using the display-review tool."
            childrenOnCopy={
              <>
                <CheckIcon /> Copy prompt
              </>
            }
          >
            <CopyIcon />
            Copy prompt
          </CopyButton>
          <Button padding="small" onClick={onDismiss} ariaLabel="Close review screen">
            <CloseIcon />
            Close
          </Button>
        </div>
      </Empty>
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
      {banner && <AttentionBanner {...banner} />}
      <ReviewHeader
        leading={
          <Button variant="ghost" size="small" padding="small" ariaLabel="Exit review" asChild>
            <a href={buildSummaryBackHref(returnSearch)} {...{ [REVIEW_SUMMARY_BACK_ATTR]: '' }}>
              <ChevronSmallLeftIcon />
              <StorybookIcon />
            </a>
          </Button>
        }
        title={state.title}
        subtitle={
          <>
            <span>Showing {pluralize(storyCount, 'story', 'stories')} for quick review</span>
            {createdAgo ? (
              <>
                <span>&bull;</span>
                <span>{createdAgo}</span>
              </>
            ) : null}
          </>
        }
        actions={
          newStoryCount > 0 ? (
            <ToggleButton
              variant="ghost"
              size="small"
              padding="small"
              ariaLabel={false}
              tooltip="Toggle filtering of new stories"
              pressed={showNewOnly}
              onClick={() => setShowNewOnly((v) => !v)}
            >
              {newStoryCount} new
            </ToggleButton>
          ) : null
        }
      />

      <ListScroll>
        <ScrollArea vertical>
          <Main>
            <SummaryLandmark>
              <SummaryCard color="agentic">
                <WandIcon />
                <SummaryContent>
                  <SummaryHeading>Summary:</SummaryHeading> <Markdown>{state.description}</Markdown>
                </SummaryContent>
              </SummaryCard>
            </SummaryLandmark>
            {visibleCollections.length === 0 ? (
              <Footer>{showNewOnly ? 'No new stories found.' : 'No collections found.'}</Footer>
            ) : (
              visibleCollections.map(({ collection, index, storyIds }) => {
                const isExpanded = expandedCollections.has(index);
                const titleId = `review-collection-title-${index}`;
                return (
                  <CollectionLandmark key={`${collection.title}-${index}`} titleId={titleId}>
                    <Card>
                      <Collapsible
                        collapsed={!isExpanded}
                        summary={
                          <CardHead onClick={() => toggleCollection(index)}>
                            <CardTitle id={titleId}>{collection.title}</CardTitle>
                            <CardControls>
                              <CardCount
                                aria-label={pluralize(storyIds.length, 'story', 'stories')}
                              >
                                {storyIds.length}
                              </CardCount>
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
                        {collection.rationale ? (
                          <CardRationale>
                            <Markdown>{collection.rationale}</Markdown>
                          </CardRationale>
                        ) : null}
                        <CollectionGrid
                          storyIds={storyIds}
                          showAll={showAllCollections.has(index)}
                          onShowAll={() => markCollectionShowAll(index)}
                          storyInfo={storyInfo}
                          getStoryHref={(storyId) =>
                            buildReviewStoryHref({ collectionIndex: index, storyId })
                          }
                          getStoryPreviewHref={getStoryPreviewHref}
                          summaryHidden={summaryHidden}
                        />
                      </Collapsible>
                    </Card>
                  </CollectionLandmark>
                );
              })
            )}
            <FooterLandmark>
              This review shows the {pluralize(storyCount, 'story', 'stories')} most relevant for
              you to spot-check right now. Because this is AI-curated, results may be inaccurate or
              incomplete.
            </FooterLandmark>
          </Main>
        </ScrollArea>
      </ListScroll>
    </Page>
  );
};
