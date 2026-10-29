import process from 'node:process';

import { Channel } from '@storybook/core/internal/channels';
import {
  internal_UniversalStore,
  internal_createCoreStores,
} from '@storybook/core/internal/services';

import type { PreviewAnnotation, StoryIndex } from '@storybook/core/internal/types';

import type { BuilderOptions } from '@storybook/builder-vite';

import {
  ADDON_ID,
  STATUS_TYPE_ID_A11Y,
  STATUS_TYPE_ID_COMPONENT_TEST,
  STORY_INDEX_CHANNEL_EVENT_NAME,
  storeOptions,
} from '../constants.ts';
import type { ErrorLike, FatalErrorEvent, StoreEvent, StoreState } from '../types.ts';
import { TestManager } from './test-manager.ts';

const channel: Channel = new Channel({
  async: true,
  transport: {
    send: (event) => {
      process.send?.(event);
    },
    setHandler: (handler) => {
      process.on('message', handler);
    },
  },
});

// The Storybook process owns every store; this child is a client over its IPC channel.
const store = internal_UniversalStore.create<StoreState, StoreEvent>({ ...storeOptions, channel });
const coreStores = internal_createCoreStores({ channel, owner: false });

const testManager = new TestManager({
  store,
  componentTestStatusStore: coreStores.status.getStatusStoreByTypeId(STATUS_TYPE_ID_COMPONENT_TEST),
  a11yStatusStore: coreStores.status.getStatusStoreByTypeId(STATUS_TYPE_ID_A11Y),
  testProviderStore: coreStores.testProvider.getTestProviderStoreById(ADDON_ID),
  onReady: () => {
    process.send?.({ type: 'ready' });
  },
  storybookOptions: {
    configDir: process.env.STORYBOOK_CONFIG_DIR || '',
  } as any,
  configLoader: process.env.STORYBOOK_CONFIG_LOADER as BuilderOptions['configLoader'],
  previewAnnotations: JSON.parse(
    process.env.STORYBOOK_PREVIEW_ANNOTATIONS || '[]'
  ) as PreviewAnnotation[],
});

channel.on(STORY_INDEX_CHANNEL_EVENT_NAME, (index: StoryIndex) => {
  testManager.storyIndex = index;
});

const exit = (code = 0) => {
  channel?.removeAllListeners();
  process.exit(code);
};

const createUnhandledErrorHandler = (message: string) => async (error: ErrorLike) => {
  try {
    const payload: FatalErrorEvent['payload'] = {
      message,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
        cause: error.cause as ErrorLike,
      },
    };
    // Node.js will exit immediately in these situations, so we can't send an event via the universal store
    // because the process will exit before the event is sent.
    // we're sending it manually instead, so the parent process can forward it to the store.
    process.send?.({
      type: 'uncaught-error',
      payload,
    });
  } finally {
    exit(1);
  }
};

process.on(
  'uncaughtException',
  createUnhandledErrorHandler('Uncaught exception in the test runner process')
);
process.on(
  'unhandledRejection',
  createUnhandledErrorHandler('Unhandled rejection in the test runner process')
);

process.on('exit', exit);
process.on('SIGINT', () => exit(0));
process.on('SIGTERM', () => exit(0));
