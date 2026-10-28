import type { StoryData } from '../../shared/router/utils.ts';

/** Structural copy of the router library's `Location`, so core types do not depend on it. */
export interface RouterLocation {
  pathname: string;
  search: string;
  hash: string;
  state: any;
  key: string;
}

export interface Other extends StoryData {
  path: string;
  singleStory?: boolean;
}

export type RenderData = { location: Partial<RouterLocation> } & Other;
