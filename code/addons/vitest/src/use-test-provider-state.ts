import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  StatusTypeId,
  StatusValue,
  StatusesByStoryIdAndTypeId,
  StoryId,
  TestProviderState,
} from 'storybook/internal/types';

import { store, testProviderStore } from '#manager-store';
import { isEqual } from 'es-toolkit/predicate';
import {
  type API,
  experimental_useStatusStore,
  experimental_useTestProviderStore,
  experimental_useUniversalStore,
} from 'storybook/manager-api';

import { ADDON_ID, STATUS_TYPE_ID_A11Y, STATUS_TYPE_ID_COMPONENT_TEST } from './constants';
import type { StoreState } from './types';

export type StatusValueToStoryIds = Record<StatusValue, StoryId[]>;

const statusValueToStoryIds = (
  allStatuses: StatusesByStoryIdAndTypeId,
  typeId: StatusTypeId,
  storyIds?: StoryId[]
) => {
  const statusValueToStoryIdsMap: StatusValueToStoryIds = {
    'status-value:pending': [],
    'status-value:success': [],
    'status-value:error': [],
    'status-value:warning': [],
    'status-value:unknown': [],
  };
  const stories = storyIds
    ? storyIds.map((storyId) => allStatuses[storyId]).filter(Boolean)
    : Object.values(allStatuses);

  stories.forEach((statusByTypeId) => {
    const status = statusByTypeId[typeId];
    if (!status) {
      return;
    }
    statusValueToStoryIdsMap[status.value].push(status.storyId);
  });

  return statusValueToStoryIdsMap;
};

export const useTestProvider = (
  api: API,
  entryId?: string
): {
  storeState: StoreState;
  setStoreState: (typeof store)['setState'];
  testProviderState: TestProviderState;
  componentTestStatusValueToStoryIds: StatusValueToStoryIds;
  a11yStatusValueToStoryIds: StatusValueToStoryIds;
  isSettingsUpdated: boolean;
} => {
  const testProviderState = experimental_useTestProviderStore((s) => s[ADDON_ID]);
  const [storeState, setStoreState] = experimental_useUniversalStore(store);

  const [isSettingsUpdated, setIsSettingsUpdated] = useState(false);
  const settingsUpdatedTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const unsubscribe = store.onStateChange((state, previousState) => {
      if (!isEqual(state.config, previousState.config)) {
        testProviderStore.settingsChanged();
        setIsSettingsUpdated(true);
        clearTimeout(settingsUpdatedTimeoutRef.current);
        settingsUpdatedTimeoutRef.current = setTimeout(() => {
          setIsSettingsUpdated(false);
        }, 1000);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(settingsUpdatedTimeoutRef.current);
    };
  }, []);

  // TODO: does this overmemo, if the index changes, would that trigger a re-calculation of storyIds?
  const storyIds = useMemo(
    () => (entryId ? api.findAllLeafStoryIds(entryId) : undefined),
    [entryId, api]
  );

  const componentTestStatusSelector = useCallback(
    (allStatuses: StatusesByStoryIdAndTypeId) =>
      statusValueToStoryIds(allStatuses, STATUS_TYPE_ID_COMPONENT_TEST, storyIds),
    [storyIds]
  );
  const componentTestStatusValueToStoryIds = experimental_useStatusStore(
    componentTestStatusSelector
  );
  const a11yStatusValueToStoryIdsSelector = useCallback(
    (allStatuses: StatusesByStoryIdAndTypeId) =>
      statusValueToStoryIds(allStatuses, STATUS_TYPE_ID_A11Y, storyIds),
    [storyIds]
  );
  const a11yStatusValueToStoryIds = experimental_useStatusStore(a11yStatusValueToStoryIdsSelector);

  return {
    storeState,
    setStoreState,
    testProviderState,
    componentTestStatusValueToStoryIds,
    a11yStatusValueToStoryIds,
    isSettingsUpdated,
  };
};
