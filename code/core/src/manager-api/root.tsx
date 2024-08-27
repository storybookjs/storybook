/* eslint-disable @typescript-eslint/naming-convention */
import type { FC, ReactElement, ReactNode } from 'react';
import React, {
  Component,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import type { Listener } from '@storybook/core/channels';
import type { RouterData } from '@storybook/core/router';
import type {
  API_ComponentEntry,
  API_ComposedRef,
  API_DocsEntry,
  API_GroupEntry,
  API_HashEntry,
  API_IndexHash,
  API_LeafEntry,
  API_OptionsData,
  API_ProviderData,
  API_Refs,
  API_RootEntry,
  API_StateMerger,
  API_StoryEntry,
  ArgTypes,
  Args,
  Globals,
  Parameters,
  StoryId,
} from '@storybook/core/types';

import { deprecate } from '@storybook/core/client-logger';
import {
  SET_STORIES,
  SHARED_STATE_CHANGED,
  SHARED_STATE_SET,
  STORY_CHANGED,
} from '@storybook/core/core-events';

import mergeWith from 'lodash/mergeWith.js';

import { createContext } from './context';
import getInitialState from './initial-state';
import { types } from './lib/addons';
import type { ModuleFn } from './lib/types';
import * as addons from './modules/addons';
import * as channel from './modules/channel';
import * as globals from './modules/globals';
import * as layout from './modules/layout';
import * as notifications from './modules/notifications';
import * as provider from './modules/provider';
import * as refs from './modules/refs';
import * as settings from './modules/settings';
import * as shortcuts from './modules/shortcuts';
import * as stories from './modules/stories';
import * as url from './modules/url';
import * as version from './modules/versions';
import * as whatsnew from './modules/whatsnew';
import type { Options } from './store';
import Store from './store';

export * from './lib/request-response';
export * from './lib/shortcut';

const { ActiveTabs } = layout;

export { default as merge } from './lib/merge';
export type { Options as StoreOptions, Listener as ChannelListener };
export { ActiveTabs };

export const ManagerContext = createContext({ api: undefined!, state: getInitialState({}!) });

export type State = layout.SubState &
  stories.SubState &
  refs.SubState &
  notifications.SubState &
  version.SubState &
  url.SubState &
  shortcuts.SubState &
  settings.SubState &
  globals.SubState &
  whatsnew.SubState &
  RouterData &
  API_OptionsData &
  DeprecatedState &
  Other;

export type API = addons.SubAPI &
  channel.SubAPI &
  provider.SubAPI &
  stories.SubAPI &
  refs.SubAPI &
  globals.SubAPI &
  layout.SubAPI &
  notifications.SubAPI &
  shortcuts.SubAPI &
  settings.SubAPI &
  version.SubAPI &
  url.SubAPI &
  whatsnew.SubAPI &
  Other;

interface DeprecatedState {
  /** @deprecated Use index */
  storiesHash: API_IndexHash;
  /** @deprecated Use previewInitialized */
  storiesConfigured: boolean;
  /** @deprecated Use indexError */
  storiesFailed?: Error;
}

interface Other {
  [key: string]: any;
}

export interface Combo {
  api: API;
  state: State;
}

export type ManagerProviderProps = RouterData &
  API_ProviderData<API> & {
    children: ReactNode | FC<Combo>;
  };

// This is duplicated from @storybook/preview-api for the reasons mentioned in lib-addons/types.js
export const combineParameters = (...parameterSets: Parameters[]) =>
  mergeWith({}, ...parameterSets, (objValue: any, srcValue: any) => {
    // Treat arrays as scalars:
    if (Array.isArray(srcValue)) {
      return srcValue;
    }

    return undefined;
  });

class ManagerProvider extends Component<ManagerProviderProps, State> {
  api: API = {} as API;

  modules: ReturnType<ModuleFn>[];

  static displayName = 'Manager';

  constructor(props: ManagerProviderProps) {
    super(props);
    const {
      location,
      path,
      refId,
      viewMode = props.docsOptions.docsMode ? 'docs' : props.viewMode,
      singleStory,
      storyId,
      docsOptions,
      navigate,
    } = props;

    const store = new Store({
      getState: () => this.state,
      setState: (stateChange: Partial<State>, callback) => {
        this.setState(stateChange, () => callback(this.state));

        return this.state;
      },
    });

    const routeData = { location, path, viewMode, singleStory, storyId, refId };
    const optionsData: API_OptionsData = { docsOptions };

    this.state = store.getInitialState(getInitialState({ ...routeData, ...optionsData }));

    const apiData = {
      navigate,
      store,
      provider: props.provider,
    };

    this.modules = [
      provider,
      channel,
      addons,
      layout,
      notifications,
      settings,
      shortcuts,
      stories,
      refs,
      globals,
      url,
      version,
      whatsnew,
    ].map((m) =>
      m.init({ ...routeData, ...optionsData, ...apiData, state: this.state, fullAPI: this.api })
    );

    // Create our initial state by combining the initial state of all modules, then overlaying any saved state
    const state = getInitialState(this.state, ...this.modules.map((m) => m.state!));

    // Get our API by combining the APIs exported by each module
    const api: API = Object.assign(this.api, { navigate }, ...this.modules.map((m) => m.api));

    this.state = state;
    this.api = api;
  }

  static getDerivedStateFromProps(props: ManagerProviderProps, state: State): State {
    if (state.path !== props.path) {
      return {
        ...state,
        location: props.location,
        path: props.path,
        refId: props.refId,
        viewMode: props.viewMode,
        storyId: props.storyId!,
      };
    }
    return null!;
  }

  shouldComponentUpdate(nextProps: ManagerProviderProps, nextState: State): boolean {
    const prevState = this.state;
    const prevProps = this.props;

    if (prevState !== nextState) {
      return true;
    }
    if (prevProps.path !== nextProps.path) {
      return true;
    }
    return false;
  }

  initModules = () => {
    // Now every module has had a chance to set its API, call init on each module which gives it
    // a chance to do things that call other modules' APIs.
    this.modules.forEach((module: any) => {
      if ('init' in module) {
        module.init();
      }
    });
  };

  render() {
    const { children } = this.props;
    const value = {
      state: this.state,
      api: this.api,
    };

    return (
      <EffectOnMount effect={this.initModules}>
        <ManagerContext.Provider value={value}>
          <ManagerConsumer>{children}</ManagerConsumer>
        </ManagerContext.Provider>
      </EffectOnMount>
    );
  }
}

// EffectOnMount exists to work around a bug in Reach Router where calling
// navigate inside of componentDidMount (as could happen when we call init on any
// of our modules) does not cause Reach Router's LocationProvider to update with
// the correct path. Calling navigate inside on an effect does not have the
// same problem. See https://github.com/reach/router/issues/404
const EffectOnMount: FC<{
  children: ReactElement;
  effect: () => void;
}> = ({ children, effect }) => {
  React.useEffect(effect, []);
  return children;
};

interface ManagerConsumerProps<P = unknown> {
  filter?: (combo: Combo) => P;
  children: FC<P> | ReactNode;
}

const defaultFilter = (c: Combo) => c;

function ManagerConsumer<P = Combo>({
  // @ts-expect-error (Converted from ts-ignore)
  filter = defaultFilter,
  children,
}: ManagerConsumerProps<P>): ReactElement {
  const managerContext = useContext(ManagerContext);
  const renderer = useRef(children);
  const filterer = useRef(filter);

  if (typeof renderer.current !== 'function') {
    return <Fragment>{renderer.current}</Fragment>;
  }

  const comboData = filterer.current(managerContext);

  const comboDataArray = useMemo(() => {
    // @ts-expect-error (No overload matches this call)
    return [...Object.entries(comboData).reduce((acc, keyval) => acc.concat(keyval), [])];
  }, [managerContext.state]);

  return useMemo(() => {
    const Child: any = renderer.current as FC<P>;

    return <Child {...comboData} />;
  }, comboDataArray);
}

export function useStorybookState(): State {
  const { state } = useContext(ManagerContext);
  return {
    ...state,

    // deprecated fields for back-compat
    get storiesHash() {
      deprecate('state.storiesHash is deprecated, please use state.index');
      return this.index || {};
    },
    get storiesConfigured() {
      deprecate('state.storiesConfigured is deprecated, please use state.previewInitialized');
      return this.previewInitialized;
    },
    get storiesFailed() {
      deprecate('state.storiesFailed is deprecated, please use state.indexError');
      return this.indexError;
    },
  };
}
export function useStorybookApi(): API {
  const { api } = useContext(ManagerContext);
  return api;
}

export type {
  /** @deprecated Now IndexHash */
  API_IndexHash as StoriesHash,
  API_IndexHash as IndexHash,
  API_RootEntry as RootEntry,
  API_GroupEntry as GroupEntry,
  API_ComponentEntry as ComponentEntry,
  API_DocsEntry as DocsEntry,
  API_StoryEntry as StoryEntry,
  API_HashEntry as HashEntry,
  API_LeafEntry as LeafEntry,
  API_ComposedRef as ComposedRef,
  API_Refs as Refs,
};
export { ManagerConsumer as Consumer, ManagerProvider as Provider };

export interface API_EventMap {
  [eventId: string]: Listener;
}

function orDefault<S>(fromStore: S, defaultState: S): S {
  if (typeof fromStore === 'undefined') {
    return defaultState;
  }
  return fromStore;
}

export const useChannel = (eventMap: API_EventMap, deps: any[] = []) => {
  const api = useStorybookApi();
  useEffect(() => {
    Object.entries(eventMap).forEach(([type, listener]) => api.on(type, listener));
    return () => {
      Object.entries(eventMap).forEach(([type, listener]) => api.off(type, listener));
    };
  }, deps);

  return api.emit;
};

export function useStoryPrepared(storyId?: StoryId) {
  const api = useStorybookApi();
  return api.isPrepared(storyId!);
}

export function useParameter<S>(parameterKey: string, defaultValue?: S) {
  const api = useStorybookApi();

  const result = api.getCurrentParameter<S>(parameterKey);
  return orDefault<S>(result, defaultValue!);
}

// cache for taking care of HMR
globalThis.STORYBOOK_ADDON_STATE = {};
const { STORYBOOK_ADDON_STATE } = globalThis;

// shared state
export function useSharedState<S>(stateId: string, defaultState?: S) {
  const api = useStorybookApi();
  const existingState = api.getAddonState<S>(stateId) || STORYBOOK_ADDON_STATE[stateId];
  const state = orDefault<S>(
    existingState,
    STORYBOOK_ADDON_STATE[stateId] ? STORYBOOK_ADDON_STATE[stateId] : defaultState
  );
  let quicksync = false;

  if (state === defaultState && defaultState !== undefined) {
    STORYBOOK_ADDON_STATE[stateId] = defaultState;
    quicksync = true;
  }

  useEffect(() => {
    if (quicksync) {
      // @ts-expect-error (Argument of type 'S | undefined' is not assignable)
      api.setAddonState<S>(stateId, defaultState);
    }
  }, [quicksync]);

  const setState = async (s: S | API_StateMerger<S>, options?: Options) => {
    await api.setAddonState<S>(stateId, s, options);
    const result = api.getAddonState(stateId);

    STORYBOOK_ADDON_STATE[stateId] = result;
    return result;
  };
  const allListeners = useMemo(() => {
    const stateChangeHandlers = {
      [`${SHARED_STATE_CHANGED}-client-${stateId}`]: setState,
      [`${SHARED_STATE_SET}-client-${stateId}`]: setState,
    };
    const stateInitializationHandlers = {
      [SET_STORIES]: async () => {
        const currentState = api.getAddonState(stateId);
        if (currentState) {
          STORYBOOK_ADDON_STATE[stateId] = currentState;
          api.emit(`${SHARED_STATE_SET}-manager-${stateId}`, currentState);
        } else if (STORYBOOK_ADDON_STATE[stateId]) {
          // this happens when HMR
          await setState(STORYBOOK_ADDON_STATE[stateId]);
          api.emit(`${SHARED_STATE_SET}-manager-${stateId}`, STORYBOOK_ADDON_STATE[stateId]);
        } else if (defaultState !== undefined) {
          // if not HMR, yet the defaults are from the manager
          await setState(defaultState);
          // initialize STORYBOOK_ADDON_STATE after first load, so its available for subsequent HMR
          STORYBOOK_ADDON_STATE[stateId] = defaultState;
          api.emit(`${SHARED_STATE_SET}-manager-${stateId}`, defaultState);
        }
      },
      [STORY_CHANGED]: () => {
        const currentState = api.getAddonState(stateId);

        if (currentState !== undefined) {
          api.emit(`${SHARED_STATE_SET}-manager-${stateId}`, currentState);
        }
      },
    };

    return {
      ...stateChangeHandlers,
      ...stateInitializationHandlers,
    };
  }, [stateId]);

  const emit = useChannel(allListeners);
  return [
    state,
    async (newStateOrMerger: S | API_StateMerger<S>, options?: Options) => {
      await setState(newStateOrMerger, options);
      const result = api.getAddonState(stateId);
      emit(`${SHARED_STATE_CHANGED}-manager-${stateId}`, result);
    },
  ] as [S, (newStateOrMerger: S | API_StateMerger<S>, options?: Options) => void];
}

export function useAddonState<S>(addonId: string, defaultState?: S) {
  return useSharedState<S>(addonId, defaultState);
}

export function useArgs(): [Args, (newArgs: Args) => void, (argNames?: string[]) => void, Args] {
  const { getCurrentStoryData, updateStoryArgs, resetStoryArgs } = useStorybookApi();

  const data = getCurrentStoryData();
  const args = data?.type === 'story' ? data.args : {};
  const initialArgs = data?.type === 'story' ? data.initialArgs : {};

  const updateArgs = useCallback(
    (newArgs: Args) => updateStoryArgs(data as API_StoryEntry, newArgs),
    [data, updateStoryArgs]
  );
  const resetArgs = useCallback(
    (argNames?: string[]) => resetStoryArgs(data as API_StoryEntry, argNames),
    [data, resetStoryArgs]
  );

  return [args!, updateArgs, resetArgs, initialArgs!];
}

export function useGlobals(): [
  globals: Globals,
  updateGlobals: (newGlobals: Globals) => void,
  storyGlobals: Globals,
  userGlobals: Globals,
] {
  const api = useStorybookApi();
  return [api.getGlobals(), api.updateGlobals, api.getStoryGlobals(), api.getUserGlobals()];
}

export function useGlobalTypes(): ArgTypes {
  return useStorybookApi().getGlobalTypes();
}

function useCurrentStory(): API_StoryEntry | API_DocsEntry {
  const { getCurrentStoryData } = useStorybookApi();

  return getCurrentStoryData();
}

export function useArgTypes(): ArgTypes {
  const current = useCurrentStory();
  return (current?.type === 'story' && current.argTypes) || {};
}

export { addons } from './lib/addons';

// We need to rename this so it's not compiled to a straight re-export
// Our globalization plugin can't handle an import and export of the same name in different lines
const typesX = types;

export { typesX as types };

/* deprecated */
export { mockChannel, type Addon, type AddonStore } from './lib/addons';
