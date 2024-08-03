import React, { memo, useCallback, useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, ComponentIcon } from '@storybook/icons';
import { styled } from '@storybook/core/theming';
import { FileSearchListLoadingSkeleton } from './FileSearchListSkeleton';
import {
  DefaultExport,
  FileList,
  FileListExport,
  FileListIconWrapper,
  FileListItem,
  FileListItemContent,
  FileListItemContentWrapper,
  FileListItemExport,
  FileListItemExportName,
  FileListItemExportNameContent,
  FileListItemLabel,
  FileListItemPath,
  FileListLi,
  FileListUl,
  FileListWrapper,
  NoResults,
  NoResultsDescription,
} from './FileList';
import type { VirtualItem } from '@tanstack/react-virtual';
import { useVirtualizer } from '@tanstack/react-virtual';
import type {
  CreateNewStoryRequestPayload,
  FileComponentSearchResponsePayload,
} from '@storybook/core/core-events';
import { WithTooltip, TooltipNote } from '@storybook/core/components';
import { useArrowKeyNavigation } from './FIleSearchList.utils';

export type SearchResult = NonNullable<FileComponentSearchResponsePayload['files']>[0];

export interface NewStoryPayload extends CreateNewStoryRequestPayload {
  selectedItemId: string | number;
}

const ChevronRightIconStyled = styled(ChevronRightIcon)(({ theme }) => ({
  display: 'none',
  alignSelf: 'center',
  color: theme.color.mediumdark,
}));

const ChevronDownIconStyled = styled(ChevronDownIcon)(({ theme }) => ({
  display: 'none',
  alignSelf: 'center',
  color: theme.color.mediumdark,
}));

interface FileSearchListProps {
  isLoading: boolean;
  searchResults: Array<SearchResult> | null;
  onNewStory: (props: NewStoryPayload) => void;
  errorItemId?: number | string;
}

interface FileItemContentProps {
  virtualItem: VirtualItem;
  selected: number | null;
  searchResult: SearchResult;
}

interface FileItemSelectionPayload {
  virtualItem: VirtualItem;
  searchResult: SearchResult;
  itemId: string;
}

interface FileItemComponentSelectionPayload {
  searchResult: SearchResult;
  component: NonNullable<SearchResult['exportedComponents']>[0];
  id: string;
}

export const FileSearchList = memo(function FileSearchList({
  isLoading,
  searchResults,
  onNewStory,
  errorItemId,
}: FileSearchListProps) {
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const parentRef = React.useRef<HTMLDivElement>();

  const sortedSearchResults = useMemo(() => {
    // search results with no exports should be at the end of the list
    return [...(searchResults ?? [])]?.sort((a, b) => {
      const isALowPriority = a.exportedComponents === null || a.exportedComponents?.length === 0;
      const hasAStory = a.storyFileExists;

      const isBLowPriority = b.exportedComponents === null || b.exportedComponents?.length === 0;
      const hasBStory = b.storyFileExists;

      if (hasAStory && !hasBStory) {
        return -1;
      }

      if (hasBStory && !hasAStory) {
        return 1;
      }

      if (isALowPriority && !isBLowPriority) {
        return 1;
      }

      if (!isALowPriority && isBLowPriority) {
        return -1;
      }

      return 0;
    });
  }, [searchResults]);

  const count = searchResults?.length || 0;

  const rowVirtualizer = useVirtualizer({
    count,
    // @ts-expect-error (non strict)

    getScrollElement: () => parentRef.current,
    paddingStart: 16,
    paddingEnd: 40,
    estimateSize: () => 54,
    overscan: 2,
  });

  // @ts-expect-error (non strict)
  useArrowKeyNavigation({ rowVirtualizer, parentRef, selectedItem });

  const handleFileItemSelection = useCallback(
    ({ virtualItem, searchResult, itemId }: FileItemSelectionPayload) => {
      // @ts-expect-error (non strict)
      if (searchResult?.exportedComponents?.length > 1) {
        setSelectedItem((sItem) => {
          if (sItem === virtualItem.index) {
            return null;
          }

          return virtualItem.index;
        });
      } else if (searchResult?.exportedComponents?.length === 1) {
        onNewStory({
          componentExportName: searchResult.exportedComponents[0].name,
          componentFilePath: searchResult.filepath,
          componentIsDefaultExport: searchResult.exportedComponents[0].default,
          selectedItemId: itemId,
          componentExportCount: 1,
        });
      }
    },
    [onNewStory]
  );

  const handleFileItemComponentSelection = useCallback(
    ({ searchResult, component, id }: FileItemComponentSelectionPayload) => {
      onNewStory({
        componentExportName: component.name,
        componentFilePath: searchResult.filepath,
        componentIsDefaultExport: component.default,
        selectedItemId: id,
        // @ts-expect-error (non strict)
        componentExportCount: searchResult.exportedComponents.length,
      });
    },
    [onNewStory]
  );

  const ListItem = useCallback(
    ({ virtualItem, selected, searchResult }: FileItemContentProps) => {
      const itemError = errorItemId === searchResult.filepath;
      const itemSelected = selected === virtualItem.index;

      return (
        <FileListItem
          aria-expanded={itemSelected}
          aria-controls={`file-list-export-${virtualItem.index}`}
          id={`file-list-item-wrapper-${virtualItem.index}`}
        >
          <FileListItemContentWrapper
            className="file-list-item"
            selected={itemSelected}
            error={itemError}
            disabled={
              searchResult.exportedComponents === null ||
              searchResult.exportedComponents?.length === 0
            }
          >
            <FileListIconWrapper error={itemError}>
              <ComponentIcon />
            </FileListIconWrapper>
            <FileListItemContent>
              <FileListItemLabel error={itemError}>
                {searchResult.filepath.split('/').at(-1)}
              </FileListItemLabel>
              <FileListItemPath>{searchResult.filepath}</FileListItemPath>
            </FileListItemContent>
            {itemSelected ? <ChevronDownIconStyled /> : <ChevronRightIconStyled />}
          </FileListItemContentWrapper>
          {/* @ts-expect-error (non strict) */}
          {searchResult?.exportedComponents?.length > 1 && itemSelected && (
            <FileListExport
              role="region"
              id={`file-list-export-${virtualItem.index}`}
              aria-labelledby={`file-list-item-wrapper-${virtualItem.index}`}
              onClick={(e) => {
                e.stopPropagation();
              }}
              onKeyUp={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                }
              }}
            >
              {searchResult.exportedComponents?.map((component, itemExportId) => {
                const itemExportError = errorItemId === `${searchResult.filepath}_${itemExportId}`;
                const position =
                  itemExportId === 0
                    ? 'first'
                    : // @ts-expect-error (non strict)
                      itemExportId === searchResult.exportedComponents.length - 1
                      ? 'last'
                      : 'middle';

                return (
                  <FileListItemExport
                    tabIndex={0}
                    data-index-position={`${virtualItem.index}_${position}`}
                    key={component.name}
                    error={itemExportError}
                    onClick={() => {
                      handleFileItemComponentSelection({
                        searchResult,
                        component,
                        id: `${searchResult.filepath}_${itemExportId}`,
                      });
                    }}
                    onKeyUp={(event) => {
                      if (event.key === 'Enter') {
                        handleFileItemComponentSelection({
                          searchResult,
                          component,
                          id: `${searchResult.filepath}_${itemExportId}`,
                        });
                      }
                    }}
                  >
                    <FileListItemExportName>
                      <ComponentIcon />
                      {component.default ? (
                        <>
                          <FileListItemExportNameContent>
                            {searchResult.filepath.split('/').at(-1)?.split('.')?.at(0)}
                          </FileListItemExportNameContent>
                          <DefaultExport>Default export</DefaultExport>
                        </>
                      ) : (
                        component.name
                      )}
                    </FileListItemExportName>
                    <ChevronRightIconStyled />
                  </FileListItemExport>
                );
              })}
            </FileListExport>
          )}
        </FileListItem>
      );
    },
    [handleFileItemComponentSelection, errorItemId]
  );

  if (isLoading && (searchResults === null || searchResults?.length === 0)) {
    return <FileSearchListLoadingSkeleton />;
  }

  if (searchResults?.length === 0) {
    return (
      <NoResults>
        <p>We could not find any file with that name</p>
        <NoResultsDescription>
          You may want to try using different keywords, check for typos, and adjust your filters
        </NoResultsDescription>
      </NoResults>
    );
  }

  if (sortedSearchResults?.length > 0) {
    return (
      <FileListWrapper>
        {/* @ts-expect-error (non strict) */}
        <FileList ref={parentRef}>
          <FileListUl
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const searchResult = sortedSearchResults[virtualItem.index];
              const noExports =
                searchResult.exportedComponents === null ||
                searchResult.exportedComponents?.length === 0;

              const itemProps = {};

              return (
                <FileListLi
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={rowVirtualizer.measureElement}
                  onClick={() => {
                    handleFileItemSelection({
                      virtualItem,
                      itemId: searchResult.filepath,
                      searchResult,
                    });
                  }}
                  onKeyUp={(event) => {
                    if (event.key === 'Enter') {
                      handleFileItemSelection({
                        virtualItem,
                        itemId: searchResult.filepath,
                        searchResult,
                      });
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  tabIndex={0}
                >
                  {noExports ? (
                    <WithTooltip
                      {...itemProps}
                      style={{ width: '100%' }}
                      hasChrome={false}
                      closeOnOutsideClick={true}
                      tooltip={
                        <TooltipNote
                          // @ts-expect-error (non strict)
                          note={
                            noExports
                              ? "We can't evaluate exports for this file. You can't create a story for it automatically"
                              : null
                          }
                        />
                      }
                    >
                      <ListItem
                        searchResult={searchResult}
                        selected={selectedItem}
                        virtualItem={virtualItem}
                      />
                    </WithTooltip>
                  ) : (
                    <ListItem
                      {...itemProps}
                      key={virtualItem.index}
                      searchResult={searchResult}
                      selected={selectedItem}
                      virtualItem={virtualItem}
                    />
                  )}
                </FileListLi>
              );
            })}
          </FileListUl>
        </FileList>
      </FileListWrapper>
    );
  }

  return null;
});
