/* eslint-disable @typescript-eslint/naming-convention */
import type { ReactElement } from 'react';

import type { Channel } from '../../channels';
import type { RenderData } from '../../router/types';
import type { ThemeVars } from '../../theming/types';
import type { Addon_RenderOptions } from './addons';
import type { API_FilterFunction, API_HashEntry, API_IndexHash } from './api-stories';
import type { SetStoriesStory, SetStoriesStoryData } from './channelApi';
import type { DocsOptions } from './core-common';
import type { StoryIndex } from './indexer';

type OrString<T extends string> = T | (string & {});

export type API_ViewMode = OrString<'story' | 'docs' | 'settings'> | undefined;

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
  /** @deprecated Will be removed in 8.0, please use channel instead */
  serverChannel?: Channel;
  renderPreview?: API_IframeRenderer;
  handleAPI(api: API): void;
  getConfig(): {
    sidebar?: API_SidebarOptions<API>;
    theme?: ThemeVars;
    StoryMapper?: API_StoryMapper;
    [k: string]: any;
  } & Partial<API_UIOptions>;
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

export interface API_UIOptions {
  name?: string;
  url?: string;
  goFullScreen: boolean;
  showStoriesPanel: boolean;
  showAddonPanel: boolean;
  addonPanelInRight: boolean;
  theme?: ThemeVars;
  selectedPanel?: string;
}

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
  showTabs: boolean;
  showToolbar: boolean;
  /** @deprecated, will be removed in 8.0 - this API no longer works */
  isToolshown?: boolean;
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
  renderLabel?: (item: API_HashEntry, api: API) => any;
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

/**
 * @deprecated Use ReactNode for the icon instead.
 * @see https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#icons-is-deprecated
 */
interface DeprecatedIconType {
  name: string;
  color?: string;
}
export interface API_Notification {
  id: string;
  content: {
    headline: string;
    subHeadline?: string | any;
  };
  duration?: number;
  link?: string;
  // TODO: Remove DeprecatedIconType in 9.0
  icon?: React.ReactNode | DeprecatedIconType;
  onClear?: (options: OnClearOptions) => void;
  onClick?: (options: OnClickOptions) => void;
}

type API_Versions = Record<string, string>;

export type API_SetRefData = Partial<
  API_ComposedRef & {
    setStoriesData: SetStoriesStoryData;
    storyIndex: StoryIndex;
  }
>;

export type API_StoryMapper = (ref: API_ComposedRef, story: SetStoriesStory) => SetStoriesStory;

export interface API_LoadedRefData {
  index?: API_IndexHash;
  filteredIndex?: API_IndexHash;
  indexError?: Error;
  previewInitialized: boolean;
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
  >
>;

export type API_Refs = Record<string, API_ComposedRef>;
export type API_RefId = string;
export type API_RefUrl = string;
