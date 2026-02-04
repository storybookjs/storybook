import type { DocsOptions } from './core-common';
import type { ArgTypes, Args, ComponentTitle, Parameters, Path, StoryId, Tag } from './csf';
import type { IndexEntry } from './indexer';
import type { StatusByTypeId } from './status';

export interface API_BaseEntry {
  id: StoryId;
  depth: number;
  name: string;
  tags: Tag[];
  refId?: string;
  renderLabel?: (item: API_HashEntry, api: any) => any;
}

export interface API_RootEntry extends API_BaseEntry {
  type: 'root';
  startCollapsed?: boolean;
  children: StoryId[];
}

export interface API_GroupEntry extends API_BaseEntry {
  type: 'group';
  parent?: StoryId;
  children: StoryId[];
}

export interface API_ComponentEntry extends API_BaseEntry {
  type: 'component';
  parent?: StoryId;
  children: StoryId[];
  importPath?: Path;
}

export interface API_DocsEntry extends API_BaseEntry {
  type: 'docs';
  parent: StoryId;
  title: ComponentTitle;
  importPath: Path;
  prepared: boolean;
  parameters?: {
    [parameterName: string]: any;
  };
}

export interface API_StoryEntry extends API_BaseEntry {
  type: 'story';
  subtype: 'story';
  parent: StoryId;
  title: ComponentTitle;
  importPath: Path;
  exportName: string;
  prepared: boolean;
  parameters?: {
    [parameterName: string]: any;
  };
  args?: Args;
  argTypes?: ArgTypes;
  initialArgs?: Args;
  children?: StoryId[];
}

export interface API_TestEntry extends Omit<API_StoryEntry, 'subtype' | 'children'> {
  subtype: 'test';
}

export type API_LeafEntry = API_DocsEntry | API_StoryEntry | API_TestEntry;
export type API_HashEntry =
  | API_RootEntry
  | API_GroupEntry
  | API_ComponentEntry
  | API_DocsEntry
  | API_StoryEntry
  | API_TestEntry;

/**
 * The `IndexHash` is our manager-side representation of the `StoryIndex`. We create entries in the
 * hash not only for each story or docs entry, but also for each "group" of the component (split on
 * '/'), as that's how things are manipulated in the manager (i.e. in the sidebar)
 */
export interface API_IndexHash {
  [id: string]: API_HashEntry;
}
// We used to received a bit more data over the channel on the SET_STORIES event, including
// the full parameters for each story.
export type API_PreparedIndexEntry = IndexEntry & {
  parameters?: Parameters;
  argTypes?: ArgTypes;
  args?: Args;
  initialArgs?: Args;
};
export interface API_PreparedStoryIndex {
  v: number;
  entries: Record<StoryId, API_PreparedIndexEntry>;
}

export type API_OptionsData = {
  docsOptions: DocsOptions;
};

export interface API_ReleaseNotes {
  success?: boolean;
  currentVersion?: string;
  showOnFirstLaunch?: boolean;
}

export interface API_Settings {
  lastTrackedStoryId: string;
}

export interface API_Version {
  version: string;
  info?: { plain: string };
  [key: string]: any;
}

export interface API_UnknownEntries {
  [key: string]: {
    [key: string]: any;
  };
}

export interface API_Versions {
  latest?: API_Version;
  next?: API_Version;
  current?: API_Version;
}

export type API_FilterFunction = (
  item: API_PreparedIndexEntry & { statuses: StatusByTypeId }
) => boolean;
