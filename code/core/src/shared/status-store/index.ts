import { useMemo } from 'react';

import type { StoryId } from 'storybook/internal/csf';

import { useStatusSummary } from '../../manager/components/sidebar/StatusContext';
import type { UniversalStore } from '../universal-store';
import type { StoreOptions } from '../universal-store/types';
import type { useUniversalStore as managerUseUniversalStore } from '../universal-store/use-universal-store-manager';

export const StatusValue = {
  PENDING: 'pending',
  SUCCESS: 'success',
  ERROR: 'error',
  WARN: 'warn',
  UNKNOWN: 'unknown',
} as const;

export type StatusTypeId = string;
export type StatusValueType = (typeof StatusValue)[keyof typeof StatusValue];

export interface Status<TStatusTypeId extends StatusTypeId> {
  value: StatusValueType;
  typeId: TStatusTypeId;
  storyId: StoryId;
  title: string;
  description: string;
  data?: any; // TODO: WHAT?
  // onClick?: () => void;
  sidebarContextMenu?: boolean;
}

// export type API_StatusUpdate = Record<StoryId, Status | null>;

// export type API_FilterFunction = (
//   item: API_PreparedIndexEntry & { status: Record<string, Status | null> }
// ) => boolean;

type TypeAndStoryIdToStatusMap<TStatusTypeId extends StatusTypeId> = Record<
  TStatusTypeId,
  Status<TStatusTypeId>[]
>;

export type StoreState = TypeAndStoryIdToStatusMap<StatusTypeId>;

export const UNIVERSAL_STATUS_STORE_OPTIONS: StoreOptions<StoreState> = {
  id: 'storybook/status',
  leader: true,
  initialState: {},
} as const;

type StatusStore = {
  get: () => Status<StatusTypeId>[];
  set: (statuses: Status<StatusTypeId>[]) => void;
  onStatusChange: (
    listener: (statuses: Status<StatusTypeId>[], prevStatuses: Status<StatusTypeId>[]) => void
  ) => () => void;
  unset: (typeIds?: StatusTypeId[], storyIds?: StoryId[]) => void;
  typeId: StatusTypeId | undefined;
};

export function createStatusStore(params: {
  universalStatusStore: UniversalStore<StoreState>;
  useUniversalStore?: never;
}): {
  getStatusStoreByTypeId: (typeId: StatusTypeId) => StatusStore;
  fullStatusStore: StatusStore;
};
export function createStatusStore(params: {
  universalStatusStore: UniversalStore<StoreState>;
  useUniversalStore: typeof managerUseUniversalStore;
}): {
  getStatusStoreByTypeId: (typeId: StatusTypeId) => StatusStore;
  fullStatusStore: StatusStore;
  useStatusStore: (
    statusStore: StatusStore,
    selector?: (statuses: Status<StatusTypeId>[]) => Status<StatusTypeId>[]
  ) => Status<StatusTypeId>[];
};
export function createStatusStore({
  universalStatusStore,
  useUniversalStore,
}: {
  universalStatusStore: UniversalStore<StoreState>;
  useUniversalStore?: typeof managerUseUniversalStore;
}): {
  getStatusStoreByTypeId: (typeId: StatusTypeId) => StatusStore;
  fullStatusStore: StatusStore;
  useStatusStore?: (
    statusStore: StatusStore,
    selector?: (statuses: Status<StatusTypeId>[]) => Status<StatusTypeId>[]
  ) => Status<StatusTypeId>[];
} {
  const fullStatusStore = {
    get(): Status<StatusTypeId>[] {
      return Object.values(universalStatusStore.getState()).flat();
    },
    set(statuses: Status<StatusTypeId>[]): void {
      const currentState = universalStatusStore.getState();
      const updateByTypeId: Record<StatusTypeId, Status<StatusTypeId>[]> = {};

      for (const status of statuses) {
        if (!updateByTypeId[status.typeId]) {
          // Initialize with existing statuses for this typeId if they exist
          updateByTypeId[status.typeId] = [...(currentState[status.typeId] ?? [])];
        }

        // Replace existing status with the same storyId or add new one
        const existingIndex = updateByTypeId[status.typeId].findIndex(
          (existing) => existing.storyId === status.storyId
        );

        if (existingIndex >= 0) {
          updateByTypeId[status.typeId][existingIndex] = status;
        } else {
          updateByTypeId[status.typeId].push(status);
        }
      }

      universalStatusStore.setState((state) => ({
        ...state,
        ...updateByTypeId,
      }));
    },
    onStatusChange(
      listener: (statuses: Status<StatusTypeId>[], prevStatuses: Status<StatusTypeId>[]) => void
    ): ReturnType<typeof universalStatusStore.subscribe> {
      return universalStatusStore.onStateChange((state, prevState) => {
        listener(Object.values(state).flat(), Object.values(prevState).flat());
      });
    },
    unset(typeIds?: StatusTypeId[], storyIds?: StoryId[]): void {
      // If no storyIds and no typeIds are provided, remove all statuses
      if (!typeIds && !storyIds) {
        universalStatusStore.setState({});
        return;
      }

      universalStatusStore.setState((state) => {
        const updatedState = { ...state };
        for (const typeId in updatedState) {
          if (typeIds && !typeIds.includes(typeId)) {
            continue;
          }
          if (!storyIds) {
            delete updatedState[typeId];
            continue;
          }

          updatedState[typeId] = updatedState[typeId].filter(
            (status) => !storyIds.includes(status.storyId)
          );
        }
        return updatedState;
      });
    },
    typeId: undefined,
  };

  const getStatusStoreByTypeId = (typeId: StatusTypeId) => ({
    get(): Status<StatusTypeId>[] {
      return universalStatusStore.getState()[typeId] ?? [];
    },
    set(statuses: Status<StatusTypeId>[]): void {
      // Validate that all statuses have the correct typeId
      for (const status of statuses) {
        if (status.typeId !== typeId) {
          throw new Error(
            `Status typeId mismatch: Status has typeId "${status.typeId}" but was added to store with typeId "${typeId}". Full status: ${JSON.stringify(
              status,
              null,
              2
            )}`
          );
        }
      }

      const existingStatuses = universalStatusStore.getState()[typeId] ?? [];

      // Filter out existing statuses that will be replaced
      const filteredExistingStatuses = existingStatuses.filter(
        (status) => !statuses.some((newStatus) => newStatus.storyId === status.storyId)
      );

      // Merge filtered existing statuses with new statuses
      const mergedStatuses = [...filteredExistingStatuses, ...statuses];

      universalStatusStore.setState((state) => ({ ...state, [typeId]: mergedStatuses }));
    },
    onStatusChange(
      listener: (statuses: Status<StatusTypeId>[], prevStatuses: Status<StatusTypeId>[]) => void
    ): ReturnType<typeof universalStatusStore.subscribe> {
      return universalStatusStore.onStateChange((state, previousState) => {
        // Only call the listener if the statuses for this specific typeId have changed
        if (state[typeId] === previousState[typeId]) {
          return;
        }

        listener(Object.values(state[typeId] ?? {}), Object.values(previousState[typeId] ?? {}));
      });
    },
    unset(storyIds?: StoryId[]): void {
      // If no storyIds are provided, remove all statuses for this typeId
      if (!storyIds) {
        universalStatusStore.setState((state) => {
          const { [typeId]: typeIdState, ...stateWithoutType } = state;
          return stateWithoutType;
        });
        return;
      }

      universalStatusStore.setState((state) => ({
        ...state,
        [typeId]: state[typeId].filter((status) => !storyIds.includes(status.storyId)),
      }));
    },
    typeId,
  });

  if (!useUniversalStore) {
    return { getStatusStoreByTypeId, fullStatusStore };
  }

  const useStatusStore = (
    statusStore: StatusStore,
    selector?: (statuses: Status<StatusTypeId>[]) => Status<StatusTypeId>[]
  ) => {
    const [statusState] = useUniversalStore(universalStatusStore, (state) => {
      const statusesForTypeId = statusStore.typeId
        ? (state[statusStore.typeId] ?? [])
        : Object.values(state).flat();
      if (!selector) {
        return statusesForTypeId;
      }
      return selector(statusesForTypeId);
    });
    return statusState;
  };

  return { getStatusStoreByTypeId, fullStatusStore, useStatusStore };
}
