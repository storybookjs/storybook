import type { FC, MouseEventHandler, PropsWithChildren, ReactNode } from 'react';
import React, { useCallback, useEffect } from 'react';

import { Button, IconButton } from '@storybook/core/components';
import { styled } from '@storybook/core/theming';
import { global } from '@storybook/global';
import { TrashIcon } from '@storybook/icons';

import { PRELOAD_ENTRIES } from '@storybook/core/core-events';
import { useStorybookApi } from '@storybook/core/manager-api';

import type { ControllerStateAndHelpers } from 'downshift';
import { transparentize } from 'polished';

import { matchesKeyCode, matchesModifiers } from '../../keybinding';
import { statusMapping } from '../../utils/status';
import { UseSymbol } from './IconSymbols';
import { StatusLabel } from './StatusButton';
import { TypeIcon } from './TreeNode';
import type { DownshiftItem, Match, SearchResult } from './types';
import { isExpandType } from './types';

const { document } = global;

const ResultsList = styled.ol({
  listStyle: 'none',
  margin: 0,
  padding: 0,
});

const ResultRow = styled.li<{ isHighlighted: boolean }>(({ theme, isHighlighted }) => ({
  width: '100%',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'start',
  justifyContent: 'space-between',
  textAlign: 'left',
  color: 'inherit',
  fontSize: `${theme.typography.size.s2}px`,
  background: isHighlighted ? theme.background.hoverable : 'transparent',
  minHeight: 28,
  borderRadius: 4,
  gap: 6,
  paddingTop: 7,
  paddingBottom: 7,
  paddingLeft: 8,
  paddingRight: 8,

  '&:hover, &:focus': {
    background: transparentize(0.93, theme.color.secondary),
    outline: 'none',
  },
}));

const IconWrapper = styled.div({
  marginTop: 2,
});

const ResultRowContent = styled.div({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
});

const NoResults = styled.div(({ theme }) => ({
  marginTop: 20,
  textAlign: 'center',
  fontSize: `${theme.typography.size.s2}px`,
  lineHeight: `18px`,
  color: theme.color.defaultText,
  small: {
    color: theme.textMutedColor,
    fontSize: `${theme.typography.size.s1}px`,
  },
}));

const Mark = styled.mark(({ theme }) => ({
  background: 'transparent',
  color: theme.color.secondary,
}));

const MoreWrapper = styled.div({
  marginTop: 8,
});

const RecentlyOpenedTitle = styled.div(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: `${theme.typography.size.s1 - 1}px`,
  fontWeight: theme.typography.weight.bold,
  minHeight: 28,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: theme.textMutedColor,
  marginTop: 16,
  marginBottom: 4,
  alignItems: 'center',

  '.search-result-recentlyOpened-clear': {
    visibility: 'hidden',
  },

  '&:hover': {
    '.search-result-recentlyOpened-clear': {
      visibility: 'visible',
    },
  },
}));

const Highlight: FC<PropsWithChildren<{ match?: Match }>> = React.memo(function Highlight({
  children,
  match,
}) {
  if (!match) {
    return children;
  }
  const { value, indices } = match;
  const { nodes: result } = indices.reduce<{ cursor: number; nodes: ReactNode[] }>(
    ({ cursor, nodes }, [start, end], index, { length }) => {
      nodes.push(<span key={`${index}-1`}>{value.slice(cursor, start)}</span>);
      nodes.push(<Mark key={`${index}-2`}>{value.slice(start, end + 1)}</Mark>);
      if (index === length - 1) {
        nodes.push(<span key={`${index}-3`}>{value.slice(end + 1)}</span>);
      }
      return { cursor: end + 1, nodes };
    },
    { cursor: 0, nodes: [] }
  );
  return <span>{result}</span>;
});

const Title = styled.div(({ theme }) => ({
  display: 'grid',
  justifyContent: 'start',
  gridAutoColumns: 'auto',
  gridAutoFlow: 'column',

  '& > span': {
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}));

const Path = styled.div(({ theme }) => ({
  display: 'grid',
  justifyContent: 'start',
  gridAutoColumns: 'auto',
  gridAutoFlow: 'column',
  fontSize: `${theme.typography.size.s1 - 1}px`,

  '& > span': {
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  '& > span + span': {
    '&:before': {
      content: "' / '",
    },
  },
}));

const Result: FC<
  SearchResult & {
    isHighlighted: boolean;
  } & React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>
> = React.memo(function Result({ item, matches, onClick, ...props }) {
  const click: MouseEventHandler<HTMLLIElement> = useCallback(
    (event) => {
      event.preventDefault();
      onClick?.(event);
    },
    [onClick]
  );

  const api = useStorybookApi();
  useEffect(() => {
    if (api && props.isHighlighted && item.type === 'component') {
      api.emit(PRELOAD_ENTRIES, { ids: [item.children[0]] }, { options: { target: item.refId } });
    }
  }, [props.isHighlighted, item]);

  const nameMatch = matches.find((match: Match) => match.key === 'name');
  const pathMatches = matches.filter((match: Match) => match.key === 'path');

  const [icon] = item.status ? statusMapping[item.status] : [];

  return (
    <ResultRow {...props} onClick={click}>
      <IconWrapper>
        {item.type === 'component' && (
          <TypeIcon viewBox="0 0 14 14" width="14" height="14" type="component">
            <UseSymbol type="component" />
          </TypeIcon>
        )}
        {item.type === 'story' && (
          <TypeIcon viewBox="0 0 14 14" width="14" height="14" type="story">
            <UseSymbol type="story" />
          </TypeIcon>
        )}
        {!(item.type === 'component' || item.type === 'story') && (
          <TypeIcon viewBox="0 0 14 14" width="14" height="14" type="document">
            <UseSymbol type="document" />
          </TypeIcon>
        )}
      </IconWrapper>
      <ResultRowContent className="search-result-item--label">
        <Title>
          <Highlight match={nameMatch}>{item.name}</Highlight>
        </Title>
        <Path>
          {item.path.map((group, index) => (
            <span key={index}>
              <Highlight match={pathMatches.find((match: Match) => match.arrayIndex === index)}>
                {group}
              </Highlight>
            </span>
          ))}
        </Path>
      </ResultRowContent>
      {item.status ? <StatusLabel status={item.status}>{icon}</StatusLabel> : null}
    </ResultRow>
  );
});

export const SearchResults: FC<{
  query: string;
  results: DownshiftItem[];
  closeMenu: (cb?: () => void) => void;
  getMenuProps: ControllerStateAndHelpers<DownshiftItem>['getMenuProps'];
  getItemProps: ControllerStateAndHelpers<DownshiftItem>['getItemProps'];
  highlightedIndex: number | null;
  isLoading?: boolean;
  enableShortcuts?: boolean;
  clearLastViewed?: () => void;
}> = React.memo(function SearchResults({
  query,
  results,
  closeMenu,
  getMenuProps,
  getItemProps,
  highlightedIndex,
  isLoading = false,
  enableShortcuts = true,
  clearLastViewed,
}) {
  const api = useStorybookApi();
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (!enableShortcuts || isLoading || event.repeat) {
        return;
      }
      if (matchesModifiers(false, event) && matchesKeyCode('Escape', event)) {
        const target = event.target as Element;

        if (target?.id === 'storybook-explorer-searchfield') {
          return; // handled by downshift
        }
        event.preventDefault();
        closeMenu();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeMenu, enableShortcuts, isLoading]);

  const mouseOverHandler: MouseEventHandler = useCallback((event) => {
    if (!api) {
      return;
    }
    const currentTarget = event.currentTarget as HTMLElement;
    const storyId = currentTarget.getAttribute('data-id');
    const refId = currentTarget.getAttribute('data-refid');
    // @ts-expect-error (non strict)
    const item = api.resolveStory(storyId, refId === 'storybook_internal' ? undefined : refId);

    if (item?.type === 'component') {
      api.emit(PRELOAD_ENTRIES, {
        // @ts-expect-error (TODO)
        ids: [item.isLeaf ? item.id : item.children[0]],
        options: { target: refId },
      });
    }
  }, []);

  const handleClearLastViewed = () => {
    // @ts-expect-error (non strict)
    clearLastViewed();
    closeMenu();
  };

  return (
    <ResultsList {...getMenuProps()}>
      {results.length > 0 && !query && (
        <RecentlyOpenedTitle className="search-result-recentlyOpened">
          Recently opened
          <IconButton
            className="search-result-recentlyOpened-clear"
            onClick={handleClearLastViewed}
          >
            <TrashIcon />
          </IconButton>
        </RecentlyOpenedTitle>
      )}
      {results.length === 0 && query && (
        <li>
          <NoResults>
            <strong>No components found</strong>
            <br />
            <small>Find components by name or path.</small>
          </NoResults>
        </li>
      )}
      {results.map((result: DownshiftItem, index) => {
        if (isExpandType(result)) {
          return (
            <MoreWrapper key="search-result-expand">
              {/* @ts-expect-error (non strict) */}
              <Button
                {...result}
                {...getItemProps({ key: index, index, item: result })}
                size="small"
              >
                Show {result.moreCount} more results
              </Button>
            </MoreWrapper>
          );
        }

        const { item } = result;
        const key = `${item.refId}::${item.id}`;
        return (
          <Result
            // @ts-expect-error (non strict)
            key={item.id}
            {...result}
            {...getItemProps({ key, index, item: result })}
            isHighlighted={highlightedIndex === index}
            data-id={result.item.id}
            data-refid={result.item.refId}
            onMouseOver={mouseOverHandler}
            className="search-result-item"
          />
        );
      })}
    </ResultsList>
  );
});
