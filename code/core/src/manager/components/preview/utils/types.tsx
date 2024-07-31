import type { ReactElement } from 'react';
import type { State, API, LeafEntry } from '@storybook/core/manager-api';
import type {
  Addon_BaseType,
  Addon_WrapperType,
  API_ViewMode,
  StoryId,
} from '@storybook/core/types';

export interface PreviewProps {
  api: API;
  viewMode: API_ViewMode;
  refs: State['refs'];
  storyId: StoryId;
  entry: LeafEntry;
  options: {
    showTabs: boolean;
    showToolbar: boolean;
  };
  id?: string;
  queryParams: State['customQueryParams'];
  customCanvas?: CustomCanvasRenderer;
  description: string;
  baseUrl: string;
  withLoader: boolean;
  tabs: Addon_BaseType[];
  tools: Addon_BaseType[];
  toolsExtra: Addon_BaseType[];
  tabId: string | undefined;
  wrappers: Addon_WrapperType[];
}

export interface ApplyWrappersProps {
  wrappers: Addon_WrapperType[];
  viewMode: State['viewMode'];
  id: string;
  storyId: StoryId;
}

export type CustomCanvasRenderer = (
  storyId: string,
  viewMode: State['viewMode'],
  id: string,
  baseUrl: string,
  scale: number,
  queryParams: Record<string, any>
) => ReactElement<any, any> | null;

export interface FramesRendererProps {
  entry: LeafEntry;
  storyId: StoryId;
  refId: string;
  baseUrl: string;
  scale: number;
  viewMode: API_ViewMode;
  queryParams: State['customQueryParams'];
  refs: State['refs'];
}
