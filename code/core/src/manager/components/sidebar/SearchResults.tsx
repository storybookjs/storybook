import type { FC, MouseEventHandler, PropsWithChildren, ReactNode } from 'react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from 'storybook/internal/components';
import { PRELOAD_ENTRIES } from 'storybook/internal/core-events';

import { global } from '@storybook/global';
import { TrashIcon } from '@storybook/icons';

import type { ControllerStateAndHelpers } from 'downshift';
import { transparentize } from 'polished';
import { useStorybookApi } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import { matchesKeyCode, matchesModifiers } from '../../keybinding.ts';
import { getStatus } from '../../utils/status.tsx';
import { UseSymbol } from './IconSymbols.tsx';
import { NoResults } from './NoResults.tsx';
import { StatusLabel } from './StatusButton.tsx';
import { TypeIcon } from './TreeNode.tsx';
import type { DownshiftItem, Match, SearchResult } from './types.ts';
import { isExpandType } from './types.ts';

const { document } = global;

const ResultsList = styled.ol({
  listStyle: 'none',
  margin: 0,
  padding: 0,
});

const ResultRow = styled.li<{
  isHighlighted: boolean;
  isChild?: boolean;
}>(({ theme, isHighlighted, isChild }) => ({
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
  paddingLeft: isChild ? 30 : 8,
  paddingRight: 8,

  '&:hover, &:focus': {
    background: transparentize(0.93, theme.color.secondary),
    outline: 'none',
  },
}));

const ComponentGroupHeading = styled.li(({ theme }) => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 28,
  paddingTop: 7,
  paddingBottom: 7,
  paddingLeft: 8,
  paddingRight: 8,
  fontSize: `${theme.typography.size.s2}px`,
  fontWeight: theme.typography.weight.bold,
}));

const ChevronButton = styled.button({
  width: 14,
  height: 18,
  padding: 0,
  margin: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',

  '&:focus-visible': {
    outline: 'none',
  },
});

const Chevron = styled.span<{ isCollapsed: boolean }>(({ theme, isCollapsed }) => ({
  display: 'block',
  width: 0,
  height: 0,
  borderTop: '4px solid transparent',
  borderBottom: '4px solid transparent',
  borderLeft: `5px solid ${theme.textMutedColor}`,
  transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
  transition: 'transform 100ms ease',
}));

const IconWrapper = styled.div({
  marginTop: 2,
});

const ResultRowContent = styled.div({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
});

const Mark = styled.mark(({ theme }) => ({
  background: 'transparent',
  color: theme.color.secondary,
  '@media (forced-colors: active)': {
    color: 'HighlightText',
    background: 'Highlight',
  },
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

const Title = styled.div({
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
});

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
      whiteSpace: 'pre',
    },
  },
}));

const Result: FC<
  SearchResult & {
    isHighlighted: boolean;
    hidePath?: boolean;
    isChild?: boolean;
    showGroupChevron?: boolean;
    isCollapsed?: boolean;
    onToggleGroup?: () => void;
  } & React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>
> = React.memo(function Result({
  item,
  matches,
  onClick,
  hidePath = false,
  isChild = false,
  showGroupChevron = false,
  isCollapsed = false,
  onToggleGroup,
  ...props
}) {
  const theme = useTheme();
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
  }, [api, props.isHighlighted, item]);

  const nameMatch = matches.find((match: Match) => match.key === 'name');
  const pathMatches = matches.filter((match: Match) => match.key === 'path');

  const icon = item.status ? getStatus(theme, item.status).icon : null;

  return (
    <ResultRow {...props} isChild={isChild} onClick={click}>
      {showGroupChevron && (
        <ChevronButton
          type="button"
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Expand component stories' : 'Collapse component stories'}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleGroup?.();
          }}
        >
          <Chevron isCollapsed={isCollapsed} />
        </ChevronButton>
      )}

      <IconWrapper>
        {item.type === 'component' && (
          <TypeIcon viewBox="0 0 14 14" width="14" height="14" type="component">
            <UseSymbol type="component" />
          </TypeIcon>
        )}
        {item.type === 'story' && (
          <TypeIcon viewBox="0 0 14 14" width="14" height="14" type={item.subtype}>
            <UseSymbol type={item.subtype} />
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

        {!hidePath && (
          <Path>
            {item.path.map((group, index) => (
              <span key={index}>
                <Highlight match={pathMatches.find((match: Match) => match.arrayIndex === index)}>
                  {group}
                </Highlight>
              </span>
            ))}
          </Path>
        )}
      </ResultRowContent>
      {item.status ? <StatusLabel status={item.status}>{icon}</StatusLabel> : null}
    </ResultRow>
  );
});

type SearchResultGroup = {
  type: 'group';
  key: string;
  component?: SearchResult;
  componentIndex?: number;
  componentName: string;
  stories: Array<{
    result: SearchResult;
    index: number;
  }>;
};

type StandaloneSearchResult = {
  type: 'result';
  result: DownshiftItem;
  index: number;
};

type GroupedSearchResult = SearchResultGroup | StandaloneSearchResult;

const groupSearchResults = (results: DownshiftItem[]): GroupedSearchResult[] => {
  const groupedResults: GroupedSearchResult[] = [];
  const groups = new Map<string, SearchResultGroup>();

  results.forEach((result, index) => {
    if (isExpandType(result)) {
      groupedResults.push({
        type: 'result',
        result,
        index,
      });

      return;
    }

    const { item } = result;

    let groupKey: string | null = null;

    if (item.type === 'component') {
      groupKey = `${item.refId}::${item.id}`;
    }

    if (item.type === 'story' && item.parent) {
      groupKey = `${item.refId}::${item.parent}`;
    }

    if (!groupKey) {
      groupedResults.push({
        type: 'result',
        result,
        index,
      });

      return;
    }

    let group = groups.get(groupKey);

    if (!group) {
      const componentName =
        item.type === 'component' ? item.name : (item.path[item.path.length - 1] ?? item.name);

      group = {
        type: 'group',
        key: groupKey,
        component: item.type === 'component' ? result : undefined,
        componentIndex: item.type === 'component' ? index : undefined,
        componentName,
        stories: [],
      };

      groups.set(groupKey, group);
      groupedResults.push(group);
    }

    if (item.type === 'component') {
      group.component = result;
      group.componentIndex = index;
      group.componentName = item.name;

      return;
    }

    if (item.type === 'story') {
      const alreadyAdded = group.stories.some(
        ({ result: existingResult }) =>
          existingResult.item.refId === item.refId && existingResult.item.id === item.id
      );

      if (!alreadyAdded) {
        group.stories.push({
          result,
          index,
        });
      }
    }
  });

  return groupedResults;
};

const SearchResultGroupView: FC<{
  group: SearchResultGroup;
  highlightedIndex: number | null;
  getItemProps: ControllerStateAndHelpers<DownshiftItem>['getItemProps'];
  mouseOverHandler: MouseEventHandler;
}> = ({ group, highlightedIndex, getItemProps, mouseOverHandler }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { component, componentIndex, componentName, stories } = group;

  const toggleGroup = () => {
    setIsCollapsed((current) => !current);
  };

  return (
    <>
      {component && componentIndex !== undefined ? (
        <Result
          {...component}
          {...getItemProps({
            key: `${component.item.refId}::${component.item.id}`,
            index: componentIndex,
            item: component,
          })}
          hidePath
          showGroupChevron={stories.length > 0}
          isCollapsed={isCollapsed}
          onToggleGroup={toggleGroup}
          isHighlighted={highlightedIndex === componentIndex}
          data-id={component.item.id}
          data-refid={component.item.refId}
          onMouseOver={mouseOverHandler}
          className="search-result-item search-result-component-group"
        />
      ) : (
        <ComponentGroupHeading>
          <ChevronButton
            type="button"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? 'Expand component stories' : 'Collapse component stories'}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              toggleGroup();
            }}
          >
            <Chevron isCollapsed={isCollapsed} />
          </ChevronButton>

          <IconWrapper>
            <TypeIcon viewBox="0 0 14 14" width="14" height="14" type="component">
              <UseSymbol type="component" />
            </TypeIcon>
          </IconWrapper>

          <span>{componentName}</span>
        </ComponentGroupHeading>
      )}

      {!isCollapsed &&
        stories.map(({ result, index }) => {
          const storyKey = `${result.item.refId}::${result.item.id}`;

          return (
            <Result
              {...result}
              {...getItemProps({
                key: storyKey,
                index,
                item: result,
              })}
              hidePath
              isChild
              isHighlighted={highlightedIndex === index}
              key={storyKey}
              data-id={result.item.id}
              data-refid={result.item.refId}
              onMouseOver={mouseOverHandler}
              className="search-result-item search-result-story-child"
            />
          );
        })}
    </>
  );
};

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

  const groupedResults = useMemo(() => groupSearchResults(results), [results]);

  return (
    <ResultsList {...getMenuProps()} key="results-list">
      {results.length > 0 && !query && (
        <RecentlyOpenedTitle className="search-result-recentlyOpened">
          Recently opened
          <Button
            padding="small"
            variant="ghost"
            className="search-result-recentlyOpened-clear"
            onClick={handleClearLastViewed}
            ariaLabel="Clear recently opened items"
          >
            <TrashIcon />
          </Button>
        </RecentlyOpenedTitle>
      )}
      {results.length === 0 && query && (
        <li>
          <NoResults>
            <strong>No components found</strong>
            <small>Find components by name or path.</small>
          </NoResults>
        </li>
      )}

      {groupedResults.map((entry) => {
        if (entry.type === 'group') {
          return (
            <SearchResultGroupView
              key={entry.key}
              group={entry}
              highlightedIndex={highlightedIndex}
              getItemProps={getItemProps}
              mouseOverHandler={mouseOverHandler}
            />
          );
        }

        const { result, index } = entry;

        if (isExpandType(result)) {
          const props = {
            ...results,
            ...getItemProps({
              key: index,
              index,
              item: result,
            }),
          };

          const { key, ...rest } = props;

          return (
            <MoreWrapper key="search-result-expand">
              <Button key={key} {...rest} size="small">
                Show {result.moreCount} more results
              </Button>
            </MoreWrapper>
          );
        }

        const { item } = result;
        const key = `${item.refId}::${item.id}`;
        return (
          <Result
            {...result}
            {...getItemProps({ key, index, item: result })}
            isHighlighted={highlightedIndex === index}
            key={key}
            data-id={item.id}
            data-refid={item.refId}
            onMouseOver={mouseOverHandler}
            className="search-result-item"
          />
        );
      })}
    </ResultsList>
  );
});
