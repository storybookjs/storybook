import type { API_ViewMode } from './api';
import type {
  Args,
  ArgTypes,
  ComponentId,
  Parameters,
  StoryId,
  StoryKind,
  Globals,
  GlobalTypes,
} from './csf';

// The data received on the (legacy) `setStories` event
export interface SetStoriesStory {
  id: StoryId;
  name: string;
  refId?: string;
  componentId?: ComponentId;
  kind: StoryKind;
  parameters: {
    fileName: string;
    options: {
      [optionName: string]: any;
    };
    docsOnly?: boolean;
    viewMode?: API_ViewMode;
    [parameterName: string]: any;
  };
  argTypes?: ArgTypes;
  args?: Args;
  initialArgs?: Args;
}

export interface SetStoriesStoryData {
  [id: string]: SetStoriesStory;
}

export type SetStoriesPayload =
  | {
      v: 2;
      error?: Error;
      globals: Args;
      globalParameters: Parameters;
      stories: SetStoriesStoryData;
      kindParameters: {
        [kind: string]: Parameters;
      };
    }
  | ({
      v?: number;
      stories: SetStoriesStoryData;
    } & Record<string, never>);

export interface SetGlobalsPayload {
  // userGlobals
  globals: Globals;
  globalTypes: GlobalTypes;
}

export interface GlobalsUpdatedPayload {
  initialGlobals: Globals;
  userGlobals: Globals;
  storyGlobals: Globals;
  globals: Globals;
}

export interface StoryPreparedPayload {
  id: StoryId;
  parameters: Parameters;
  argTypes: ArgTypes;
  initialArgs: Args;
  args: Args;
}

export interface DocsPreparedPayload {
  id: StoryId;
  parameters: Parameters;
}
