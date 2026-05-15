import type { FC } from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useStorybookState, type API } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { getActiveFilterCount } from '../../../shared/utils/story-index-filters.ts';
import { getStateType } from '../../utils/tree.ts';
import { AuthBlock, EmptyBlock, ErrorBlock, LoaderBlock } from './RefBlocks.tsx';
import { RefIndicator } from './RefIndicator.tsx';
import { DEFAULT_REF_ID } from './Sidebar.tsx';
import { Tree } from './Tree.tsx';
import { CollapseIcon } from './components/CollapseIcon.tsx';
import type { RefType } from './types.ts';

export interface RefProps {
  api: API;
  docsMode: boolean;
  isLoading: boolean;
  isBrowsing: boolean;
  isDevelopment: boolean;
  hasEntries: boolean;
  selectedStoryId: string | null;
}

const Wrapper = styled.div<{ isMain: boolean }>(({ isMain }) => ({
  position: 'relative',
  marginTop: isMain ? undefined : 0,
}));

const RefHead = styled.div(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
  fontSize: theme.typography.size.s2,

  // Similar to ListItem.tsx
  textDecoration: 'none',
  lineHeight: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: 'transparent',

  width: '100%',
  marginTop: 20,
  paddingTop: 16,
  paddingBottom: 12,
  borderTop: `1px solid ${theme.appBorderColor}`,

  color: theme.color.defaultText,
}));

const RefTitle = styled.div({
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
  overflow: 'hidden',
  marginLeft: 2,
});

// TODO review
const CollapseButton = styled.button(({ theme }) => ({
  all: 'unset',
  display: 'flex',
  padding: '0px 8px',
  gap: 6,
  alignItems: 'center',
  cursor: 'pointer',
  overflow: 'hidden',

  '&:focus': {
    borderColor: theme.color.secondary,
    'span:first-of-type': {
      borderLeftColor: theme.color.secondary,
    },
  },
}));

export const Ref: FC<RefType & RefProps> = React.memo(function Ref(props) {
  const storybookState = useStorybookState();
  const {
    api,
    filteredIndex: index,
    id: refId,
    title = refId,
    isLoading: isLoadingMain,
    isBrowsing,
    isDevelopment,
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
        <RefHead
          aria-label={`${isExpanded ? 'Hide' : 'Show'} ${title} stories`}
          aria-expanded={isExpanded}
        >
          <CollapseButton data-action="collapse-ref" onClick={handleClick}>
            <CollapseIcon isExpanded={isExpanded} />
            <RefTitle title={title}>{title}</RefTitle>
          </CollapseButton>
          <RefIndicator {...props} state={state} ref={indicatorRef} />
        </RefHead>
      )}
      {isExpanded && index && (
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
          {state === 'ready' && (
            <Tree
              api={api}
              allStatuses={allStatuses}
              isBrowsing={isBrowsing}
              isDevelopment={isDevelopment}
              isMain={isMain}
              refId={refId}
              data={index}
              // @ts-expect-error (non strict)
              docsMode={storybookState.docsOptions.docsMode}
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
