import React, { type FC, type ReactNode, useEffect, useRef, useState } from 'react';

import { Button, IconButton } from 'storybook/internal/components';
import { styled } from 'storybook/theming';

import { StorybookIcon } from '@storybook/icons';

import { prettifyComponentId } from '../review-grouping.ts';
import { buildStorybookStoryHref } from '../review-navigation.ts';

const PREVIEW_SCALE = 0.5;

/** Component title + story name for a story, resolved from the Storybook index. */
export interface StoryInfo {
  title: string;
  name: string;
}

// Column count is driven entirely by container width — 1 column on narrow
// (mobile) widths up to 4 on wide screens — with each cell clamped to 400px so
// a lone preview never stretches across the card. Each band also caps the grid
// to two rows: once more stories exist than fit, the overflow cells are hidden
// and a "Review all" cell takes the last visible slot. Both behaviors are pure
// CSS (`:has()` + `:nth-child`), so no layout measurement runs in JS.
const band = (cols: number) => {
  const cap = cols * 2;
  return {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 400px))`,
    [`&:not([data-show-all]):has(> [data-cell]:nth-child(${cap + 1})) > [data-cell]:nth-child(n + ${cap})`]:
      {
        display: 'none',
      },
    [`&:not([data-show-all]):has(> [data-cell]:nth-child(${cap + 1})) > [data-review-all]`]: {
      display: 'grid',
    },
  };
};

const GridContainer = styled.div({
  containerType: 'inline-size',
  containerName: 'review-grid',
});

const Grid = styled.div({
  display: 'grid',
  gap: 12,
  padding: 12,
  justifyContent: 'start',
  // Fallback for browsers without container-query support: a single column and
  // no two-row cap (every story is shown).
  gridTemplateColumns: 'minmax(0, 400px)',
  // Bands are mutually exclusive (ranged) so a narrower band's overflow rules
  // never bleed into a wider one.
  '@container review-grid (max-width: 629.98px)': band(1),
  '@container review-grid (min-width: 630px) and (max-width: 844.98px)': band(2),
  '@container review-grid (min-width: 845px) and (max-width: 1259.98px)': band(3),
  '@container review-grid (min-width: 1260px)': band(4),
});

const Cell = styled.div({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
});

// The bordered, clickable preview frame. Rendered as an <a> when a detail href
// is provided, otherwise a plain <div>. Hover and keyboard focus are indicated
// here (not on the surrounding cell) since the frame is the interactive target.
const Frame = styled.a(({ theme }) => ({
  position: 'relative',
  display: 'block',
  width: '100%',
  aspectRatio: '3 / 2',
  borderRadius: 6,
  overflow: 'hidden',
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
  transition: 'border-color 120ms ease',
  textDecoration: 'none',
  outline: 'none',
  '&[href]:hover': {
    borderColor: theme.color.secondary,
  },
  '&:focus-visible': {
    outline: `${theme.barSelectedColor} solid 2px`,
    outlineOffset: 2,
  },
}));

const Preview = styled.iframe({
  position: 'absolute',
  inset: 0,
  width: `${(1 / PREVIEW_SCALE) * 100}%`,
  height: `${(1 / PREVIEW_SCALE) * 100}%`,
  border: 0,
  display: 'block',
  transform: `scale(${PREVIEW_SCALE})`,
  transformOrigin: 'top left',
  pointerEvents: 'none',
});

// The info/action bar below the preview: the component/story label stretches
// and ellipsizes on the left; the action slot on the right never wraps.
const ActionBar = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minHeight: 36,
});

const Label = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flex: 1,
  minWidth: 0,
  marginLeft: 10,
  overflow: 'hidden',
});

const LabelComponent = styled.span({
  fontWeight: 700,
  whiteSpace: 'nowrap',
  flexShrink: 0,
  maxWidth: '60%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const LabelSeparator = styled.span(({ theme }) => ({
  color: theme.textMutedColor,
  flexShrink: 0,
}));

const LabelStory = styled.span({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const ActionSlot = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flexShrink: 0,
  whiteSpace: 'nowrap',
});

const ReviewAllCell = styled.div(({ theme }) => ({
  display: 'none',
  placeItems: 'center',
  width: '100%',
  aspectRatio: '3 / 2',
  borderRadius: 6,
  background: theme.background.app,
  border: `1px dashed ${theme.appBorderColor}`,
}));

// Search matches are tinted with the accent colour; weight is inherited so a
// match keeps the bold component / normal story styling.
const Mark = styled.mark(({ theme }) => ({
  background: 'transparent',
  color: theme.color.secondary,
  fontWeight: 'inherit',
}));

const storyPreviewUrl = (id: string) => `iframe.html?id=${encodeURIComponent(id)}&viewMode=story`;

// Render `text`, wrapping every case-insensitive occurrence of `query` in a
// <Mark>. With no query the text renders untouched.
const Highlight: FC<{ text: string; query: string }> = ({ text, query }) => {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return <>{text}</>;
  }
  const haystack = text.toLowerCase();
  const segments: ReactNode[] = [];
  let cursor = 0;
  let match = haystack.indexOf(needle);
  let key = 0;
  while (match !== -1) {
    if (match > cursor) {
      segments.push(text.slice(cursor, match));
    }
    segments.push(<Mark key={key++}>{text.slice(match, match + needle.length)}</Mark>);
    cursor = match + needle.length;
    match = haystack.indexOf(needle, cursor);
  }
  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }
  return <>{segments}</>;
};

const deriveStoryInfo = (
  storyId: string,
  info?: StoryInfo
): { component: string; name: string } => {
  if (info) {
    return { component: info.title.split('/').pop() ?? info.title, name: info.name };
  }
  const [componentId, ...rest] = storyId.split('--');
  return {
    component: prettifyComponentId(componentId),
    name: prettifyComponentId(rest.join('--')) || 'Story',
  };
};

const StoryPreviewCell: FC<{
  storyId: string;
  href?: string;
  info?: StoryInfo;
  query: string;
}> = ({ storyId, href, info, query }) => {
  const hostRef = useRef<HTMLAnchorElement>(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || hasMounted) {
      return undefined;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setHasMounted(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [hasMounted]);

  const { component, name } = deriveStoryInfo(storyId, info);

  return (
    <Cell data-cell data-testid="review-collection-grid-cell">
      <Frame
        as={href ? 'a' : 'div'}
        href={href}
        ref={hostRef}
        aria-label={href ? `Review story ${storyId}` : undefined}
      >
        {hasMounted ? (
          <Preview
            title={storyId}
            src={storyPreviewUrl(storyId)}
            loading="lazy"
            tabIndex={-1}
            scrolling="no"
          />
        ) : null}
      </Frame>
      <ActionBar>
        <Label>
          <LabelComponent>
            <Highlight text={component} query={query} />
          </LabelComponent>
          <LabelSeparator>/</LabelSeparator>
          <LabelStory>
            <Highlight text={name} query={query} />
          </LabelStory>
        </Label>
        <ActionSlot>
          {/* <IconButton
            variant="ghost"
            size="small"
            padding="small"
            ariaLabel="View in Storybook"
            asChild
          >
            <a href={buildStorybookStoryHref(storyId)} target="_blank" rel="noreferrer">
              <StorybookIcon />
            </a>
          </IconButton> */}
        </ActionSlot>
      </ActionBar>
    </Cell>
  );
};

export interface CollectionGridProps {
  storyIds: string[];
  getStoryHref?: (storyId: string, storyIndex: number) => string | undefined;
  /** Persisted "review all" state from the parent list. */
  showAll?: boolean;
  /** Called when the user expands to "Review all". */
  onShowAll?: () => void;
  /** Story id → component title + story name, for the cell label. */
  storyInfo?: Record<string, StoryInfo>;
  /** Active search query — matches in the cell label are highlighted. */
  query?: string;
}

export const CollectionGrid: FC<CollectionGridProps> = ({
  storyIds,
  getStoryHref,
  showAll = false,
  onShowAll,
  storyInfo,
  query = '',
}) => (
  <GridContainer>
    <Grid data-show-all={showAll || undefined} data-testid="review-collection-grid">
      {storyIds.map((storyId, storyIndex) => (
        <StoryPreviewCell
          key={storyId}
          storyId={storyId}
          href={getStoryHref?.(storyId, storyIndex)}
          info={storyInfo?.[storyId]}
          query={query}
        />
      ))}
      <ReviewAllCell data-review-all>
        <Button size="medium" onClick={() => onShowAll?.()}>
          Review all {storyIds.length}
        </Button>
      </ReviewAllCell>
    </Grid>
  </GridContainer>
);
