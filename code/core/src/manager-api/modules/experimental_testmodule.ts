import { type API_StoryEntry, Addon_TypesEnum, type StoryId } from '@storybook/core/types';

import {
  TESTING_MODULE_CANCEL_TEST_RUN_REQUEST,
  TESTING_MODULE_RUN_ALL_REQUEST,
  TESTING_MODULE_RUN_REQUEST,
  TESTING_MODULE_WATCH_MODE_REQUEST,
  type TestProviderId,
  type TestProviderState,
  type TestProviders,
  type TestingModuleRunAllRequestPayload,
  type TestingModuleRunRequestPayload,
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
          return { testProviders: { ...testProviders, [id]: { ...testProviders[id], ...update } } };
        },
        { persistence: 'session' }
      );
    },
    clearTestProviderState(id) {
      const update = {
        cancelling: false,
        running: true,
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
      if (!options?.entryId) {
        const payload: TestingModuleRunAllRequestPayload = { providerId: id };
        fullAPI.emit(TESTING_MODULE_RUN_ALL_REQUEST, payload);
        return () => api.cancelTestProvider(id);
      }

      const index = store.getState().index;
      invariant(index, 'The index is currently unavailable');

      const entry = index[options.entryId];

      invariant(entry, `No entry found in the index for id '${options.entryId}'`);

      if (entry.type === 'story') {
        const payload: TestingModuleRunRequestPayload = {
          providerId: id,
          payload: [
            {
              importPath: entry.importPath,
              stories: [
                {
                  id: entry.id,
                  name: entry.name,
                },
              ],
            },
          ],
        };
        fullAPI.emit(TESTING_MODULE_RUN_REQUEST, payload);
        return () => api.cancelTestProvider(id);
      }

      const payloads = new Set<TestingModuleRunRequestPayload['payload'][0]>();

      const findComponents = (entryId: StoryId) => {
        const foundEntry = index[entryId];
        switch (foundEntry.type) {
          case 'component':
            const firstStoryId = foundEntry.children.find(
              (childId) => index[childId].type === 'story'
            );
            if (!firstStoryId) {
              // happens when there are only docs in the component
              return;
            }
            payloads.add({ importPath: (index[firstStoryId] as API_StoryEntry).importPath });
            return;
          case 'story': {
            // this shouldn't happen because we don't visit components' children.
            // so we never get to a story directly.
            payloads.add({
              importPath: foundEntry.importPath,
              stories: [
                {
                  id: foundEntry.id,
                  name: foundEntry.name,
                },
              ],
            });
            return;
          }
          case 'docs': {
            return;
          }
          default:
            foundEntry.children.forEach(findComponents);
        }
      };
      findComponents(options.entryId);

      const payload: TestingModuleRunRequestPayload = {
        providerId: id,
        payload: Array.from(payloads),
      };
      fullAPI.emit(TESTING_MODULE_RUN_REQUEST, payload);

      return () => api.cancelTestProvider(id);
    },
    setTestProviderWatchMode(id, watchMode) {
      api.updateTestProviderState(id, { watching: watchMode });
      fullAPI.emit(TESTING_MODULE_WATCH_MODE_REQUEST, { providerId: id, watchMode });
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
          } as TestProviders[0],
        ]
      )
    );

    store.setState({ testProviders: initialState }, { persistence: 'session' });
  };
  return { init: initModule, state, api };
};
