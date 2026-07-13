import type { FC } from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BookIcon } from '@storybook/icons';

import { useStorybookState, type API } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { getActiveFilterCount } from '../../../shared/utils/story-index-filters.ts';
import { getStateType } from '../../utils/tree.ts';
import { AuthBlock, EmptyBlock, ErrorBlock, LoaderBlock } from './RefBlocks.tsx';
import { RefIndicator } from './RefIndicator.tsx';
import { DEFAULT_REF_ID } from './Sidebar.tsx';
import { Tree } from './Tree.tsx';
import { CollapseIcon } from './CollapseIcon.tsx';
import type { RefType } from './types.ts';

export interface RefProps {
  api: API;
  isLoading: boolean;
  isBrowsing: boolean;
  hasEntries: boolean;
  selectedStoryId: string | null;
}

const Wrapper = styled.div<{ isMain: boolean }>(({ isMain }) => ({
  // The main tree fills the remaining sidebar height and scrolls itself (virtualized).
  ...(isMain && { flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }),
  position: 'relative',
  marginTop: isMain ? undefined : 0,
}));

const RefHead = styled.div(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  background: 'transparent',
  minHeight: 28,
  borderRadius: 4,
  width: '100%',
  marginTop: 28,
  color: theme.color.defaultText,

  // Highlight the whole row on hover or when the toggle button is keyboard-focused.
  '&:hover, &:has(button:focus-visible)': {
    background: theme.background.hoverable,
    color: theme.barHoverColor,
  },

  // Icon swap: BookIcon visible at rest, CollapseIcon visible on hover/focus.
  '.hover-only': {
    display: 'none',
  },
  '.static-only': {
    display: 'flex',
    alignItems: 'center',
  },
  '&:hover .hover-only, &:has(button:focus-visible) .hover-only': {
    display: 'flex',
    alignItems: 'center',
  },
  '&:hover .static-only, &:has(button:focus-visible) .static-only': {
    display: 'none',
  },
}));

const RefTitle = styled.span({
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const CollapseButton = styled.button(({ theme }) => ({
  all: 'unset',
  display: 'flex',
  alignItems: 'center',
  flex: '1 1 auto',
  minHeight: 28,
  paddingInlineStart: 7,
  gap: 6,
  cursor: 'pointer',
  overflow: 'hidden',
  borderRadius: 4,
  boxSizing: 'border-box',

  '&:focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 2px ${theme.background.app}, 0 0 0 4px ${theme.color.secondary}`,
  },
}));

const RefBookIcon = styled(BookIcon)({
  width: 14,
  height: 14,
  flex: '0 0 auto',
  color: 'currentColor',
});

export const Ref: FC<RefType & RefProps> = React.memo(function Ref(props) {
  const storybookState = useStorybookState();
  const {
    api,
    filteredIndex: index,
    id: refId,
    title = refId,
    isLoading: isLoadingMain,
    isBrowsing,
    hasEntries,
    selectedStoryId,
    loginUrl,
    type,
    expanded = true,
    indexError,
    previewInitialized,
    allStatuses,
  } = props;

  const length = useMemo(() => (index ? Object.keys(index).length : 0), [index]);
  const indicatorRef = useRef(null);

  const isMain = refId === DEFAULT_REF_ID;
  const isLoadingInjected =
    (type === 'auto-inject' && !previewInitialized) || type === 'server-checked';
  const isLoading = isLoadingMain || isLoadingInjected || type === 'unknown';
  const isError = !!indexError;
  const isEmpty = !isLoading && length === 0;
  const isAuthRequired = !!loginUrl && length === 0;
  const activeFilterCount = getActiveFilterCount(storybookState);

  const state = getStateType(isLoading, isAuthRequired, isError, isEmpty);
  const [isExpanded, setExpanded] = useState<boolean>(expanded);

  useEffect(() => {
    if (index && selectedStoryId && index[selectedStoryId]) {
      setExpanded(true);
    }
  }, [index, selectedStoryId]);

  const handleClick = useCallback(() => setExpanded((value) => !value), []);

  // const setHighlightedItemId = useCallback(
  //   (itemId: string) => setHighlighted({ itemId, refId }),
  //   [setHighlighted, refId]
  // );

  const onSelectStoryId = useCallback(
    (storyId: string) => api?.selectStory(storyId, undefined, { ref: isMain ? undefined : refId }),
    [api, isMain, refId]
  );

  return (
    <>
      {isMain || (
        <RefHead>
          <CollapseButton
            data-action="collapse-ref"
            onClick={handleClick}
            aria-label={`${isExpanded ? 'Hide' : 'Show'} ${title} stories`}
            aria-expanded={isExpanded}
          >
            <span className="static-only">
              <RefBookIcon />
            </span>
            <span className="hover-only">
              <CollapseIcon isExpanded={isExpanded} />
            </span>
            <RefTitle title={title}>{title}</RefTitle>
          </CollapseButton>
          <RefIndicator {...props} state={state} ref={indicatorRef} />
        </RefHead>
      )}
      {isExpanded && (
        <Wrapper data-title={title} isMain={isMain}>
          {/* @ts-expect-error (non strict) */}
          {state === 'auth' && <AuthBlock id={refId} loginUrl={loginUrl} />}
          {/* @ts-expect-error (non strict) */}
          {state === 'error' && <ErrorBlock error={indexError} />}
          {state === 'loading' && <LoaderBlock isMain={isMain} />}
          {state === 'empty' && (
            <EmptyBlock
              isMain={isMain}
              hasEntries={hasEntries}
              activeFilterCount={activeFilterCount}
            />
          )}
          {state === 'ready' && index && (
            <Tree
              allStatuses={allStatuses}
              includedStatusFilters={storybookState.includedStatusFilters}
              isBrowsing={isBrowsing}
              isMain={isMain}
              refId={refId}
              data={index}
              selectedStoryId={selectedStoryId}
              onSelectStoryId={onSelectStoryId}
              // highlightedRef={highlightedRef}
              // setHighlightedItemId={setHighlightedItemId}
            />
          )}
        </Wrapper>
      )}
    </>
  );
});
