import type { API_ViewMode } from './api.ts';
import type {
  ArgTypes,
  Args,
  ComponentTitle,
  GlobalTypes,
  Globals,
  Parameters,
  StoryId,
  StoryName,
} from './csf.ts';

export type SelectStoryPayload =
  | { storyId: StoryId; viewMode?: API_ViewMode; scrollTo?: string }
  // `title` is optional so a bare `name` can target the current component's story.
  | { title?: ComponentTitle; name?: StoryName; viewMode?: API_ViewMode; scrollTo?: string };

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
