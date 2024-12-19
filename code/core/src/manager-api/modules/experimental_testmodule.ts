import { Addon_TypesEnum, type StoryId } from '@storybook/core/types';

import {
  TESTING_MODULE_CANCEL_TEST_RUN_REQUEST,
  TESTING_MODULE_RUN_ALL_REQUEST,
  TESTING_MODULE_RUN_REQUEST,
  TESTING_MODULE_WATCH_MODE_REQUEST,
  type TestProviderId,
  type TestProviderState,
  type TestProviders,
  type TestingModuleRunRequestPayload,
  type TestingModuleWatchModeRequestPayload,
} from '@storybook/core/core-events';

import invariant from 'tiny-invariant';

import type { ModuleFn } from '../lib/types';

export type SubState = {
  testProviders: TestProviders;
};

const initialTestProviderState: TestProviderState = {
  details: {} as { [key: string]: any },
  cancellable: false,
  cancelling: false,
  running: false,
  watching: false,
  failed: false,
  crashed: false,
};

interface RunOptions {
  entryId?: StoryId;
}

export type SubAPI = {
  getTestProviderState(id: string): TestProviderState | undefined;
  updateTestProviderState(id: TestProviderId, update: Partial<TestProviderState>): void;
  clearTestProviderState(id: TestProviderId): void;
  runTestProvider(id: TestProviderId, options?: RunOptions): () => void;
  setTestProviderWatchMode(id: TestProviderId, watchMode: boolean): void;
  cancelTestProvider(id: TestProviderId): void;
};

export const init: ModuleFn<SubAPI, SubState> = ({ store, fullAPI }) => {
  const state: SubState = {
    testProviders: store.getState().testProviders || {},
  };

  const api: SubAPI = {
    getTestProviderState(id) {
      const { testProviders } = store.getState();
      return testProviders?.[id];
    },
    updateTestProviderState(id, update) {
      return store.setState(
        ({ testProviders }) => {
          const currentState = testProviders[id];
          const updatedState = currentState.stateUpdater?.(currentState, update) ?? {
            ...currentState,
            ...update,
            details: { ...currentState.details, ...update.details },
          };
          return { testProviders: { ...testProviders, [id]: updatedState } };
        },
        { persistence: 'session' }
      );
    },
    clearTestProviderState(id) {
      const update = {
        cancelling: false,
        running: false,
        failed: false,
        crashed: false,
        progress: undefined,
      };
      return store.setState(
        ({ testProviders }) => {
          return { testProviders: { ...testProviders, [id]: { ...testProviders[id], ...update } } };
        },
        { persistence: 'session' }
      );
    },
    runTestProvider(id, options) {
      const index = store.getState().index;
      invariant(index, 'The index is currently unavailable');

      api.updateTestProviderState(id, {
        running: true,
        failed: false,
        crashed: false,
        progress: undefined,
      });

      const provider = store.getState().testProviders[id];

      const indexUrl = new URL('index.json', window.location.href).toString();

      if (!options?.entryId) {
        const payload: TestingModuleRunRequestPayload = {
          providerId: id,
          indexUrl,
          config: provider.config,
        };

        fullAPI.emit(TESTING_MODULE_RUN_REQUEST, payload);

        // For backwards compatibility:
        fullAPI.emit(TESTING_MODULE_RUN_ALL_REQUEST, { providerId: id });

        return () => api.cancelTestProvider(id);
      }

      const entry = index[options.entryId];
      invariant(entry, `No entry found in the index for id '${options.entryId}'`);

      const findStories = (entryId: StoryId, results: StoryId[] = []): StoryId[] => {
        const node = index[entryId];
        if (node.type === 'story') {
          results.push(node.id);
        } else if ('children' in node) {
          node.children.forEach((childId) => findStories(childId, results));
        }
        return results;
      };

      const payload: TestingModuleRunRequestPayload = {
        providerId: id,
        indexUrl,
        storyIds: findStories(options.entryId),
        config: provider.config,
      };
      fullAPI.emit(TESTING_MODULE_RUN_REQUEST, payload);
      return () => api.cancelTestProvider(id);
    },
    setTestProviderWatchMode(id, watchMode) {
      api.updateTestProviderState(id, { watching: watchMode });
      const config = store.getState().testProviders[id].config;
      fullAPI.emit(TESTING_MODULE_WATCH_MODE_REQUEST, {
        providerId: id,
        watchMode,
        config,
      } as TestingModuleWatchModeRequestPayload);
    },
    cancelTestProvider(id) {
      api.updateTestProviderState(id, { cancelling: true });
      fullAPI.emit(TESTING_MODULE_CANCEL_TEST_RUN_REQUEST, { providerId: id });
    },
  };

  const initModule = async () => {
    const initialState: TestProviders = Object.fromEntries(
      Object.entries(fullAPI.getElements(Addon_TypesEnum.experimental_TEST_PROVIDER)).map(
        ([id, config]) => [
          id,
          {
            ...config,
            ...initialTestProviderState,
            ...(state?.testProviders?.[id] || {}),
            running: false,
          } as TestProviders[0],
        ]
      )
    );

    store.setState({ testProviders: initialState }, { persistence: 'session' });
  };
  return { init: initModule, state, api };
};
