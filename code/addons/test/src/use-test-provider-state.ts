import { useCallback, useMemo } from 'react';

import type {
  StatusTypeId,
  StatusValue,
  StatusesByStoryIdAndTypeId,
  StoryId,
  TestProviderState,
} from 'storybook/internal/types';

import { store } from '#manager-store';
import {
  type API,
  experimental_useStatusStore,
  experimental_useTestProviderStore,
  experimental_useUniversalStore,
} from 'storybook/manager-api';

import {
  ADDON_ID,
  STATUS_TYPE_ID_A11Y,
  STATUS_TYPE_ID_COMPONENT_TEST,
  type StoreState,
} from './constants';

export type StatusCountsByValue = Record<StatusValue, number>;

const statusCountsByValue = (
  allStatuses: StatusesByStoryIdAndTypeId,
  typeId: StatusTypeId,
  storyIds?: StoryId[]
) => {
  const counts: StatusCountsByValue = {
    'status-value:pending': 0,
    'status-value:success': 0,
    'status-value:error': 0,
    'status-value:warning': 0,
    'status-value:unknown': 0,
  };
  const stories = storyIds
    ? storyIds.map((storyId) => allStatuses[storyId]).filter(Boolean)
    : Object.values(allStatuses);

  stories.forEach((statusByTypeId) => {
    const status = statusByTypeId[typeId];
    if (!status) {
      return;
    }
    counts[status.value]++;
  });

  return counts;
};

export const useTestProvider = (
  api: API,
  entryId?: string
): {
  storeState: StoreState;
  setStoreState: (typeof store)['setState'];
  testProviderState: TestProviderState;
  componentTestStatusCountsByValue: StatusCountsByValue;
  a11yStatusCountsByValue: StatusCountsByValue;
} => {
  const testProviderState = experimental_useTestProviderStore((s) => s[ADDON_ID]);
  const [storeState, setStoreState] = experimental_useUniversalStore(store);

  // TODO: does this overmemo, if the index changes, would that trigger a re-calculation of storyIds?
  const storyIds = useMemo(
    () => (entryId ? api.findAllLeafStoryIds(entryId) : undefined),
    [entryId, api]
  );

  const componentTestStatusCountsByValueSelector = useCallback(
    (allStatuses: StatusesByStoryIdAndTypeId) => {
      return statusCountsByValue(allStatuses, STATUS_TYPE_ID_COMPONENT_TEST, storyIds);
    },
    [storyIds]
  );
  const componentTestStatusCountsByValue = experimental_useStatusStore(
    componentTestStatusCountsByValueSelector
  );
  const a11yStatusCountsByValueSelector = useCallback(
    (allStatuses: StatusesByStoryIdAndTypeId) => {
      return statusCountsByValue(allStatuses, STATUS_TYPE_ID_A11Y, storyIds);
    },
    [storyIds]
  );
  const a11yStatusCountsByValue = experimental_useStatusStore(a11yStatusCountsByValueSelector);

  return {
    storeState,
    setStoreState,
    testProviderState,
    componentTestStatusCountsByValue,
    a11yStatusCountsByValue,
  };
};
