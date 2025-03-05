import type { StoryId } from 'storybook/internal/csf';

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

export interface Status {
  value: StatusValueType;
  typeId: StatusTypeId;
  storyId: StoryId;
  title: string;
  description: string;
  data?: any;
  sidebarContextMenu?: boolean;
}

// export type API_StatusUpdate = Record<StoryId, Status | null>;

// export type API_FilterFunction = (
//   item: API_PreparedIndexEntry & { status: Record<string, Status | null> }
// ) => boolean;

type StatusByTypeId = Record<StatusTypeId, Status>;
export type StatusesByStoryIdAndTypeId = Record<StoryId, StatusByTypeId>;

type UseStatusStore = (selector?: (statuses: StatusesByStoryIdAndTypeId) => any) => any;

export const UNIVERSAL_STATUS_STORE_OPTIONS: StoreOptions<StatusesByStoryIdAndTypeId> = {
  id: 'storybook/status',
  leader: true,
  initialState: {},
} as const;

type StatusStore = {
  get: () => StatusesByStoryIdAndTypeId;
  set: (statuses: Status[]) => void;
  onStatusChange: (
    listener: (
      statuses: StatusesByStoryIdAndTypeId,
      previousStatuses: StatusesByStoryIdAndTypeId
    ) => void
  ) => () => void;
  unset: (storyIds?: StoryId[]) => void;
  typeId: StatusTypeId | undefined;
};

export function createStatusStore(params: {
  universalStatusStore: UniversalStore<StatusesByStoryIdAndTypeId>;
  useUniversalStore?: never;
}): {
  getStatusStoreByTypeId: (typeId: StatusTypeId) => StatusStore;
  fullStatusStore: StatusStore;
};
export function createStatusStore(params: {
  universalStatusStore: UniversalStore<StatusesByStoryIdAndTypeId>;
  useUniversalStore: typeof managerUseUniversalStore;
}): {
  getStatusStoreByTypeId: (typeId: StatusTypeId) => StatusStore;
  fullStatusStore: StatusStore;
  useStatusStore: UseStatusStore;
};
export function createStatusStore({
  universalStatusStore,
  useUniversalStore,
}: {
  universalStatusStore: UniversalStore<StatusesByStoryIdAndTypeId>;
  useUniversalStore?: typeof managerUseUniversalStore;
}): {
  getStatusStoreByTypeId: (typeId: StatusTypeId) => StatusStore;
  fullStatusStore: StatusStore;
  useStatusStore?: UseStatusStore;
} {
  const fullStatusStore: StatusStore = {
    get() {
      return universalStatusStore.getState();
    },
    set(statuses) {
      universalStatusStore.setState((state) => {
        // Create a new state object to merge with the current state
        const newState = { ...state };

        // Process each status and merge it into the appropriate storyId record
        for (const status of statuses) {
          const { storyId, typeId } = status;

          newState[storyId] = { ...(newState[storyId] ?? {}), [typeId]: status };
        }
        return newState;
      });
    },
    onStatusChange(
      listener: (
        statuses: StatusesByStoryIdAndTypeId,
        prevStatuses: StatusesByStoryIdAndTypeId
      ) => void
    ): ReturnType<typeof universalStatusStore.onStateChange> {
      return universalStatusStore.onStateChange((state, prevState) => {
        listener(state, prevState);
      });
    },
    unset(storyIds?: StoryId[]): void {
      // If no storyIds are provided, remove all statuses
      if (!storyIds) {
        universalStatusStore.setState({});
        return;
      }

      universalStatusStore.setState((state) => {
        const newState = { ...state };
        for (const storyId in newState) {
          if (storyIds.includes(storyId)) {
            delete newState[storyId];
          }
        }
        return newState;
      });
    },
    typeId: undefined,
  };

  const getStatusStoreByTypeId = (typeId: StatusTypeId): StatusStore => ({
    get: fullStatusStore.get,
    set(statuses): void {
      universalStatusStore.setState((state) => {
        // Create a new state object to merge with the current state
        const newState = { ...state };

        // Process each status and merge it into the appropriate storyId record
        for (const status of statuses) {
          const { storyId } = status;
          if (status.typeId !== typeId) {
            // Validate that all statuses have the correct typeId
            throw new Error(
              `Status typeId mismatch: Status has typeId "${status.typeId}" but was added to store with typeId "${typeId}". Full status: ${JSON.stringify(
                status,
                null,
                2
              )}`
            );
          }

          newState[storyId] = { ...(newState[storyId] ?? {}), [typeId]: status };
        }
        return newState;
      });
    },
    onStatusChange: fullStatusStore.onStatusChange,
    unset(storyIds?: StoryId[]): void {
      universalStatusStore.setState((state) => {
        const newState = { ...state };
        for (const storyId in newState) {
          if (newState[storyId][typeId] && (!storyIds || storyIds?.includes(storyId))) {
            const { [typeId]: statusWithTypeId, ...storyStatusesWithoutTypeId } = newState[storyId];
            newState[storyId] = storyStatusesWithoutTypeId;
          }
        }
        return newState;
      });
    },
    typeId,
  });

  if (!useUniversalStore) {
    return { getStatusStoreByTypeId, fullStatusStore };
  }

  return {
    getStatusStoreByTypeId,
    fullStatusStore,
    useStatusStore: (selector) => useUniversalStore(universalStatusStore, selector as any)[0],
  };
}
