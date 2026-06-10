import React, { useEffect, useRef, useState, type FC } from 'react';

import { styled } from 'storybook/theming';

import { type StoryInfo } from './components/CollectionGrid.tsx';
import { buildReviewStoryHref, prettifyComponentId } from './review-navigation.ts';

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

const MiniPreviewWrap = styled.div(({ theme }) => ({
  width: 72,
  height: 48,
  flexShrink: 0,
  position: 'relative',
  borderRadius: 6,
  overflow: 'hidden',
  background: theme.background.app,
  border: `1px solid ${theme.appBorderColor}`,
}));

const MiniPreviewFrame = styled.iframe({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '200%',
  height: '200%',
  border: 0,
  transform: 'scale(0.5)',
  transformOrigin: 'top left',
  pointerEvents: 'none',
});

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

const MiniPreview: FC<{ previewHref: string; storyId: string }> = ({ previewHref, storyId }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) {
      return undefined;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setSrc(previewHref);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSrc(previewHref);
          observer.disconnect();
        }
      },
      { rootMargin: '40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [previewHref]);

  return (
    <MiniPreviewWrap ref={wrapRef}>
      {src ? <MiniPreviewFrame title={storyId} src={src} tabIndex={-1} scrolling="no" /> : null}
    </MiniPreviewWrap>
  );
};

export interface ReviewCollectionPickerProps {
  storyIds: string[];
  storyInfo: Record<string, StoryInfo>;
  currentStoryId: string;
  collectionIndex: number;
  getStoryPreviewHref: (storyId: string) => string;
  onClose: () => void;
}

export const ReviewCollectionPicker: FC<ReviewCollectionPickerProps> = ({
  storyIds,
  storyInfo,
  currentStoryId,
  collectionIndex,
  getStoryPreviewHref,
  onClose,
}) => {
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  return (
    <PopoverList role="list" aria-label="Stories in this collection">
      {storyIds.map((storyId) => {
        const { component, story } = derivePopoverLabel(storyId, storyInfo[storyId]);
        const href = buildReviewStoryHref({ collectionIndex, storyId });
        const isActive = storyId === currentStoryId;
        return (
          <PopoverItem
            key={storyId}
            $active={isActive}
            ref={isActive ? activeRef : undefined}
            href={href}
            onClick={onClose}
          >
            <MiniPreview storyId={storyId} previewHref={getStoryPreviewHref(storyId)} />
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
