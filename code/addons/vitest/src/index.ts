import { experimental_getStatusStore } from 'storybook/internal/core-server';
import { type StoryId, definePreviewAddon } from 'storybook/internal/csf';

import { STATUS_TYPE_ID_COMPONENT_TEST } from './constants';
import type { Store } from './types';

export default () => definePreviewAddon({});

export async function triggerTestRun(actor: string, storyIds?: StoryId[]) {
  // TODO: there must be a smarter way to share the store here
  // while still lazy initializing it in the experimental_serverChannel preset
  const store: Store | undefined = (globalThis as any).__STORYBOOK_ADDON_VITEST_STORE__;
  if (!store) {
    throw new Error('store not ready yet');
  }

  await store.untilReady();

  const {
    currentRun: { startedAt, finishedAt },
  } = store.getState();
  if (startedAt && !finishedAt) {
    throw new Error('tests are already running');
  }

  store.send({
    type: 'TRIGGER_RUN',
    payload: {
      storyIds,
      triggeredBy: `external:${actor}`,
    },
  });

  return new Promise((resolve, reject) => {
    const unsubscribe = store.subscribe((event) => {
      switch (event.type) {
        case 'TEST_RUN_COMPLETED': {
          console.log('Completed!');
          console.dir(event.payload, { depth: 5 });
          unsubscribe();

          const storyStatuses = Object.values(
            experimental_getStatusStore(STATUS_TYPE_ID_COMPONENT_TEST).getAll()
          ).filter((statusByTypeId) =>
            event.payload.storyIds?.includes(statusByTypeId[STATUS_TYPE_ID_COMPONENT_TEST].storyId)
          );

          resolve({ ...event.payload, storyStatuses });
          return;
        }
        case 'FATAL_ERROR': {
          console.log('ERROR!');
          console.dir(event.payload, { depth: 5 });
          unsubscribe();
          reject(event.payload);
          return;
        }
        case 'CANCEL_RUN': {
          console.log('CANCEL!');
          console.dir(event, { depth: 5 });
          unsubscribe();
          reject('cancelled');
          return;
        }
      }
    });
  });
}
