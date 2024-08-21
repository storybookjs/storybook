/* eslint-disable @typescript-eslint/naming-convention */
import type { DocsOptions } from './core-common';
import type { ArgTypes, Args, ComponentTitle, Parameters, Path, StoryId, Tag } from './csf';
import type { IndexEntry } from './indexer';

export interface API_BaseEntry {
  id: StoryId;
  depth: number;
  name: string;
  refId?: string;
  renderLabel?: (item: API_BaseEntry, api: any) => any;
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
}

export interface API_DocsEntry extends API_BaseEntry {
  type: 'docs';
  parent: StoryId;
  title: ComponentTitle;
  importPath: Path;
  tags: Tag[];
  prepared: boolean;
  parameters?: {
    [parameterName: string]: any;
  };
}

export interface API_StoryEntry extends API_BaseEntry {
  type: 'story';
  parent: StoryId;
  title: ComponentTitle;
  importPath: Path;
  componentPath: Path;
  tags: Tag[];
  prepared: boolean;
  parameters?: {
    [parameterName: string]: any;
  };
  args?: Args;
  argTypes?: ArgTypes;
  initialArgs?: Args;
}

export type API_LeafEntry = API_DocsEntry | API_StoryEntry;
export type API_HashEntry =
  | API_RootEntry
  | API_GroupEntry
  | API_ComponentEntry
  | API_DocsEntry
  | API_StoryEntry;

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

export type API_StatusValue = 'pending' | 'success' | 'error' | 'warn' | 'unknown';

export interface API_StatusObject {
  status: API_StatusValue;
  title: string;
  description: string;
  data?: any;
  onClick?: () => void;
}

export type API_StatusState = Record<StoryId, Record<string, API_StatusObject>>;
export type API_StatusUpdate = Record<StoryId, API_StatusObject | null>;

export type API_FilterFunction = (
  item: API_PreparedIndexEntry & { status: Record<string, API_StatusObject | null> }
) => boolean;
