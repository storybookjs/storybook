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
export type StatusByTypeId = Record<StatusTypeId, Status>;
export type StatusesByStoryIdAndTypeId = Record<StoryId, StatusByTypeId>;

export interface Status {
  value: StatusValueType;
  typeId: StatusTypeId;
  storyId: StoryId;
  title: string;
  description: string;
  data?: any;
  sidebarContextMenu?: boolean;
}

export const UNIVERSAL_STATUS_STORE_OPTIONS: StoreOptions<StatusesByStoryIdAndTypeId> = {
  id: 'storybook/status',
  leader: true,
  initialState: {},
} as const;

const StatusStoreEventType = {
  SELECT: 'select',
} as const;

export type StatusStoreEvent = {
  type: typeof StatusStoreEventType.SELECT;
  payload: Status[];
};

export type StatusStore = {
  get: () => StatusesByStoryIdAndTypeId;
  set: (statuses: Status[]) => void;
  onStatusChange: (
    listener: (
      statuses: StatusesByStoryIdAndTypeId,
      previousStatuses: StatusesByStoryIdAndTypeId
    ) => void
  ) => () => void;
  onSelect: (listener: (selectedStatuses: Status[]) => void) => () => void;
  unset: (storyIds?: StoryId[]) => void;
};
type FullStatusStore = StatusStore & {
  selectStatuses: (statuses: Status[]) => void;
  typeId: undefined;
};
export type StatusStoreByTypeId = StatusStore & {
  typeId: StatusTypeId;
};

export type UseStatusStore = (selector?: (statuses: StatusesByStoryIdAndTypeId) => any) => any;

export function createStatusStore(params: {
  universalStatusStore: UniversalStore<StatusesByStoryIdAndTypeId, StatusStoreEvent>;
  useUniversalStore?: never;
}): {
  getStatusStoreByTypeId: (typeId: StatusTypeId) => StatusStoreByTypeId;
  fullStatusStore: FullStatusStore;
};
export function createStatusStore(params: {
  universalStatusStore: UniversalStore<StatusesByStoryIdAndTypeId, StatusStoreEvent>;
  useUniversalStore: typeof managerUseUniversalStore;
}): {
  getStatusStoreByTypeId: (typeId: StatusTypeId) => StatusStoreByTypeId;
  fullStatusStore: FullStatusStore;
  useStatusStore: UseStatusStore;
};
export function createStatusStore({
  universalStatusStore,
  useUniversalStore,
}: {
  universalStatusStore: UniversalStore<StatusesByStoryIdAndTypeId, StatusStoreEvent>;
  useUniversalStore?: typeof managerUseUniversalStore;
}): {
  getStatusStoreByTypeId: (typeId: StatusTypeId) => StatusStoreByTypeId;
  fullStatusStore: FullStatusStore;
  useStatusStore?: UseStatusStore;
} {
  const fullStatusStore: FullStatusStore = {
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
    onSelect(listener) {
      return universalStatusStore.subscribe(StatusStoreEventType.SELECT, (event) => {
        listener(event.payload);
      });
    },
    selectStatuses: (statuses: Status[]) => {
      universalStatusStore.send({ type: StatusStoreEventType.SELECT, payload: statuses });
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

  const getStatusStoreByTypeId = (typeId: StatusTypeId): StatusStoreByTypeId => ({
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
    onSelect(listener) {
      return universalStatusStore.subscribe(StatusStoreEventType.SELECT, (event) => {
        if (event.payload.some((status) => status.typeId === typeId)) {
          listener(event.payload);
        }
      });
    },
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
