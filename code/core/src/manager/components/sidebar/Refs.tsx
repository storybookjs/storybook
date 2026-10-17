import type { FC } from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BookIcon } from '@storybook/icons';

import { useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { getActiveFilterCount } from '../../../shared/utils/story-index-filters.ts';
import { getStateType } from '../../utils/tree.ts';
import { AuthBlock, EmptyBlock, ErrorBlock, LoaderBlock } from './RefBlocks.tsx';
import { RefIndicator } from './RefIndicator.tsx';
import { DEFAULT_REF_ID } from './Sidebar.tsx';
import { Tree } from './Tree.tsx';
import { CollapseIcon } from './CollapseIcon.tsx';
import type { RefType } from './types.ts';
import { iconSwap, truncatedLabel } from './treeRowStyles.ts';

export interface RefProps {
  isLoading: boolean;
  hasEntries: boolean;
  selectedStoryId: string | null;
}

// Every block takes its natural height and stacks in the sidebar's one scroll area, so a block
// can never be squeezed to nothing or come to rest below the visible area.
const Wrapper = styled.div({
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
});

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

  '&:hover, &:has(button:focus-visible)': {
    background: theme.background.hoverable,
    color: theme.barHoverColor,
  },

  // Show the BookIcon at rest. Show the CollapseIcon on hover and on keyboard focus.
  ...iconSwap(['&:hover', '&:has(button:focus-visible)']),
}));

const RefTitle = styled.span(truncatedLabel);

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
  const api = useStorybookApi();
  const storybookState = useStorybookState();
  const {
    filteredIndex: index,
    id: refId,
    title = refId,
    isLoading: isLoadingMain,
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

  const onSelectStoryId = useCallback(
    (storyId: string) => api.selectStory(storyId, undefined, { ref: isMain ? undefined : refId }),
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
        <Wrapper data-title={title}>
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
              refId={refId}
              data={index}
              selectedStoryId={selectedStoryId}
              onSelectStoryId={onSelectStoryId}
            />
          )}
        </Wrapper>
      )}
    </>
  );
});
