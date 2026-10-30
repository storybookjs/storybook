import type { Addon_BaseType } from 'storybook/internal/types';

import { addons, type API, type State } from 'storybook/manager-api';

import type { StoryArgs } from './page-model.ts';

export type InstanceScope = {
  instanceId: string;
  storyId: string;
  globals: StoryArgs;
  onGlobalsChange: (instanceId: string, globals: StoryArgs) => void;
};

type ParameterSource = Pick<API, 'getParameters' | 'getCurrentParameter'>;

/** Read a parameter of the instance's story, falling back to the selected entry's parameters. */
export function instanceParameter<S>(
  api: ParameterSource,
  storyId: string,
  key: string
): S | undefined {
  return (api.getParameters(storyId, key) as S | null) || api.getCurrentParameter<S>(key);
}

/**
 * Wrap the manager API so toolbar tools read and write one docs instance's globals.
 *
 * Tools built on `useGlobals`, `useParameter`, and `useViewport` see this instance as the selected
 * story in story view mode. Their `updateGlobals` calls reach `onGlobalsChange` for this instance
 * only, never the manager's global store. Shortcut registration is dropped, because a page with
 * several canvases has no single target for a keyboard shortcut.
 */
export function scopeManagerApi(api: API, scope: InstanceScope): API {
  const { instanceId, storyId, globals, onGlobalsChange } = scope;
  return {
    ...api,
    getGlobals: () => globals,
    getUserGlobals: () => globals,
    getStoryGlobals: () => ({}),
    updateGlobals: (next) => onGlobalsChange(instanceId, { ...globals, ...next }),
    getCurrentParameter: <S>(key?: string) =>
      key === undefined
        ? (api.getParameters(storyId) as S)
        : (instanceParameter<S>(api, storyId, key) as S),
    getCurrentStoryData: () => api.getData(storyId),
    getUrlState: () => ({ ...api.getUrlState(), storyId, viewMode: 'story' }),
    setAddonShortcut: async (_addon, shortcut) => shortcut,
  };
}

export function scopeManagerState(state: State, scope: InstanceScope): State {
  return {
    ...state,
    storyId: scope.storyId,
    viewMode: 'story',
    globals: scope.globals,
    userGlobals: scope.globals,
    storyGlobals: {},
  };
}

/**
 * The addon tools registered for the manager toolbar that apply to this instance's story.
 *
 * Core's page tools (zoom, remount, fullscreen, share, addons panel) act on the single preview and
 * are not registered as addon elements, so they never appear here.
 */
export function instanceTools(
  tools: Addon_BaseType[],
  scope: Pick<InstanceScope, 'storyId'>,
  state: Pick<State, 'location' | 'path' | 'refId'>
): Addon_BaseType[] {
  const hidden = (addons.getConfig().toolbar ?? {}) as Record<string, { hidden?: boolean }>;
  return tools.filter(
    (tool) =>
      tool &&
      !(tool.id && hidden[tool.id]?.hidden) &&
      (!tool.match ||
        tool.match({
          storyId: scope.storyId,
          refId: state.refId,
          viewMode: 'story',
          location: state.location,
          path: state.path,
        }))
  );
}
