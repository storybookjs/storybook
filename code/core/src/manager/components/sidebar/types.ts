import type { StatusValue, StatusesByStoryIdAndTypeId } from 'storybook/internal/types';

import type { ControllerStateAndHelpers } from 'downshift';
import type { State, StoriesHash } from 'storybook/manager-api';

export type Refs = State['refs'];
export type RefType = Refs[keyof Refs] & {
  allStatuses?: StatusesByStoryIdAndTypeId;
};
export type Item = StoriesHash[keyof StoriesHash];

/**
 * The third argument the sidebar passes to `renderLabel` and `renderAriaLabel`. The tree always
 * reports `sidebar`, including inside the mobile drawer: `bottom-bar` is reserved for the mobile
 * bottom bar, whose labels the documentation advises integrators to strip down.
 */
export interface SidebarLabelContext {
  isMobile: boolean;
  location: 'sidebar';
}
export type Dataset = Record<string, Item>;

export interface CombinedDataset {
  hash: Refs;
  entries: [string, RefType][];
}

export interface StoryRef {
  storyId: string;
  refId: string;
  anchor?: string;
}

export type Selection = StoryRef | null;

export interface Match {
  value: string;
  indices: [number, number][];
  key: 'name' | 'path';
  arrayIndex: number;
}

export function isExpandType(x: any): x is ExpandType {
  return !!(x && x.showAll);
}
export function isSearchResult(x: any): x is SearchResult {
  return !!(x && x.item);
}
export interface ExpandType {
  showAll: () => void;
  totalCount: number;
  moreCount: number;
}

export type SearchItem = Item & { refId: string; path: string[]; status?: StatusValue };

export type SearchResult = Fuse.FuseResultWithMatches<SearchItem> &
  Fuse.FuseResultWithScore<SearchItem>;

export type DownshiftItem = SearchResult | ExpandType;

export type SearchChildrenFn = (args: {
  query: string;
  results: DownshiftItem[];
  // Whether the nav explorer should be visible in the UI. When the search input is
  // focused, it gets replaced with a list of recently viewed stories. When there
  // is a search query, it gets replaced by the search results.
  isNavVisible: boolean;
  // Whether the nav explorer should be reachable in the document. When the search
  // input is focused, we keep the nav rendered in the document and reachable by
  // keyboard, so keyboard shortcuts to navigate to it still work.
  isNavReachable: boolean;
  // Whether the UI with search results or recently viewed pages is visible.
  isSearchResultRendered: boolean;
  closeMenu: (cb?: () => void) => void;
  getMenuProps: ControllerStateAndHelpers<DownshiftItem>['getMenuProps'];
  getItemProps: ControllerStateAndHelpers<DownshiftItem>['getItemProps'];
  highlightedIndex: number | null;
}) => React.ReactNode;
