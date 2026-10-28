import type { ReactElement } from 'react';

import type { Channel } from '../channels/index.ts';
import type { Addon_RenderOptions } from './addons.ts';
import type {
  API_FilterFunction,
  API_HashEntry,
  API_IndexHash,
  API_PreparedIndexEntry,
  API_RefStoryRuntimeData,
} from './modules/api-stories.ts';
import type { DocsOptions } from './modules/core-common.ts';
import type { RenderData } from './modules/router.ts';
import type { ThemeVars } from './modules/theming.ts';
import type { StoryIndex } from './modules/indexer.ts';

type OrString<T extends string> = T | (string & {});

export type API_ViewMode = OrString<'story' | 'docs' | 'settings' | 'review'> | undefined;

export type API_RenderOptions = Addon_RenderOptions;

export interface API_RouteOptions {
  storyId: string;
  viewMode: API_ViewMode;
  location: RenderData['location'];
  path: string;
}
export interface API_MatchOptions {
  storyId: string;
  viewMode: API_ViewMode;
  location: RenderData['location'];
  path: string;
}

export type API_StateMerger<S> = (input: S) => S;

export interface API_ProviderData<API> {
  provider: API_Provider<API>;
  docsOptions: DocsOptions;
}

export interface API_Provider<API> {
  channel?: Channel;
  renderPreview?: API_IframeRenderer;
  handleAPI(api: API): void;
  getConfig(): {
    sidebar?: API_SidebarOptions<API>;
    theme?: ThemeVars;
    selectedPanel?: string;
    [k: string]: any;
  };
  [key: string]: any;
}

export type API_IframeRenderer = (
  storyId: string,
  viewMode: API_ViewMode,
  id: string,
  baseUrl: string,
  scale: number,
  queryParams: Record<string, any>
) => ReactElement<any, any> | null;

export type FilterFunction = (entry: API_PreparedIndexEntry, excluded?: boolean) => boolean;

export interface API_Layout {
  initialActive: API_ActiveTabsType;
  navSize: number;
  bottomPanelHeight: number;
  rightPanelWidth: number;
  /**
   * The sizes of the panels when they were last visible used to restore the sizes when the panels
   * are shown again eg. when toggling fullscreen, panels, etc.
   */
  recentVisibleSizes: {
    navSize: number;
    bottomPanelHeight: number;
    rightPanelWidth: number;
  };
  panelPosition: API_PanelPositions;
  showNav: boolean;
  showPanel: boolean;
  showToolbar: boolean;
  /**
   * Whether the mobile navigation drawer is open. Below the mobile breakpoint the sidebar is a
   * drawer owned by the manager UI rather than the desktop nav size, so this is its open/closed
   * state. Ephemeral: it always starts as `false` and is never restored from a persisted session.
   */
  showMobileNavigation: boolean;
}

/** `TState` is the manager API state; it is a parameter because core types cannot import the manager. */
export interface API_LayoutCustomisations<TState = any> {
  showPanel?: (state: TState, defaultValue: boolean) => boolean | undefined;
  showSidebar?: (state: TState, defaultValue: boolean) => boolean | undefined;
  showToolbar?: (state: TState, defaultValue: boolean) => boolean | undefined;
}

export interface API_UI {
  name?: string;
  url?: string;
  enableShortcuts: boolean;
}

export type API_PanelPositions = 'bottom' | 'right';
export type API_ActiveTabsType = 'sidebar' | 'canvas' | 'addons';

export interface API_SidebarOptions<API = any> {
  showRoots?: boolean;
  filters?: Record<string, API_FilterFunction>;
  collapsedRoots?: string[];
  renderAriaLabel?: (
    item: API_HashEntry,
    api: API,
    // Optional so pre-existing consumers that invoke these callbacks with two arguments
    // keep compiling; Storybook itself always passes the context.
    context?: {
      isMobile: boolean;
      location: 'sidebar' | 'bottom-bar';
    }
  ) => string;
  renderLabel?: (
    item: API_HashEntry,
    api: API,
    context?: {
      isMobile: boolean;
      location: 'sidebar' | 'bottom-bar';
    }
  ) => any;
}

interface OnClearOptions {
  /** `true` when the user manually dismissed the notification. */
  dismissed: boolean;
  /** `true` when the notification timed out after the set duration. */
  timeout: boolean;
}

interface OnClickOptions {
  /** Function to dismiss the notification. */
  onDismiss: () => void;
}

export interface API_Notification {
  id: string;
  content: {
    headline: string;
    subHeadline?: string | any;
  };
  duration?: number;
  link?: string;
  icon?: React.ReactNode;
  onClear?: (options: OnClearOptions) => void;
  onClick?: (options: OnClickOptions) => void;
}

type API_Versions = Record<string, string>;

export type API_SetRefData = Partial<
  API_ComposedRef & {
    storyIndex: StoryIndex;
  }
>;

export interface API_LoadedRefData {
  index?: API_IndexHash;
  filteredIndex?: API_IndexHash;
  indexError?: Error;
  previewInitialized: boolean;
  /**
   * Runtime story enrichment (args, argTypes, parameters, initialArgs, prepared) received from the
   * ref preview via STORY_PREPARED / DOCS_PREPARED, cached so it survives ref index (re)builds. See
   * `API_RefStoryRuntimeData`.
   */
  storyUpdates?: API_RefStoryRuntimeData;
}

export interface API_ComposedRef extends API_LoadedRefData {
  id: string;
  title?: string;
  url: string;
  type?: 'auto-inject' | 'unknown' | 'lazy' | 'server-checked';
  expanded?: boolean;
  versions?: API_Versions;
  loginUrl?: string;
  version?: string;
  sourceUrl?: string;
  /** DO NOT USE THIS */
  internal_index?: StoryIndex;
}

export type API_ComposedRefUpdate = Partial<
  Pick<
    API_ComposedRef,
    | 'title'
    | 'type'
    | 'expanded'
    | 'index'
    | 'filteredIndex'
    | 'versions'
    | 'loginUrl'
    | 'version'
    | 'indexError'
    | 'previewInitialized'
    | 'sourceUrl'
    | 'internal_index'
    | 'storyUpdates'
  >
>;

export type API_Refs = Record<string, API_ComposedRef>;
export type API_RefId = string;
export type API_RefUrl = string;
