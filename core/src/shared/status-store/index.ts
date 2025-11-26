import { StatusTypeIdMismatchError as ManagerStatusTypeIdMismatchError } from '../../manager-errors';
import { StatusTypeIdMismatchError as PreviewStatusTypeIdMismatchError } from '../../preview-errors';
import { StatusTypeIdMismatchError as ServerStatusTypeIdMismatchError } from '../../server-errors';
import type { StoryId } from '../../types';
import type { UniversalStore } from '../universal-store';
import type { StoreOptions } from '../universal-store/types';
import type { useUniversalStore as managerUseUniversalStore } from '../universal-store/use-universal-store-manager';

export type StatusValue =
  | 'status-value:pending'
  | 'status-value:success'
  | 'status-value:error'
  | 'status-value:warning'
  | 'status-value:unknown';

export type StatusTypeId = string;
export type StatusByTypeId = Record<StatusTypeId, Status>;
export type StatusesByStoryIdAndTypeId = Record<StoryId, StatusByTypeId>;

export interface Status {
  value: StatusValue;
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
  getAll: () => StatusesByStoryIdAndTypeId;
  set: (statuses: Status[]) => void;
  onAllStatusChange: (
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

export type StatusStoreEnvironment = 'server' | 'manager' | 'preview';

export type UseStatusStore = <T = StatusesByStoryIdAndTypeId>(
  selector?: (statuses: StatusesByStoryIdAndTypeId) => T
) => T;

export function createStatusStore(params: {
  universalStatusStore: UniversalStore<StatusesByStoryIdAndTypeId, StatusStoreEvent>;
  useUniversalStore?: never;
  environment: StatusStoreEnvironment;
}): {
  getStatusStoreByTypeId: (typeId: StatusTypeId) => StatusStoreByTypeId;
  fullStatusStore: FullStatusStore;
  universalStatusStore: UniversalStore<StatusesByStoryIdAndTypeId, StatusStoreEvent>;
};
export function createStatusStore(params: {
  universalStatusStore: UniversalStore<StatusesByStoryIdAndTypeId, StatusStoreEvent>;
  useUniversalStore: typeof managerUseUniversalStore;
  environment: StatusStoreEnvironment;
}): {
  getStatusStoreByTypeId: (typeId: StatusTypeId) => StatusStoreByTypeId;
  fullStatusStore: FullStatusStore;
  useStatusStore: UseStatusStore;
  universalStatusStore: UniversalStore<StatusesByStoryIdAndTypeId, StatusStoreEvent>;
};
export function createStatusStore({
  universalStatusStore,
  useUniversalStore,
  environment,
}: {
  universalStatusStore: UniversalStore<StatusesByStoryIdAndTypeId, StatusStoreEvent>;
  useUniversalStore?: typeof managerUseUniversalStore;
  environment: StatusStoreEnvironment;
}): {
  getStatusStoreByTypeId: (typeId: StatusTypeId) => StatusStoreByTypeId;
  fullStatusStore: FullStatusStore;
  useStatusStore?: UseStatusStore;
  universalStatusStore: UniversalStore<StatusesByStoryIdAndTypeId, StatusStoreEvent>;
} {
  const fullStatusStore: FullStatusStore = {
    getAll() {
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
    onAllStatusChange(
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
        for (const storyId of storyIds) {
          delete newState[storyId];
        }
        return newState;
      });
    },
    typeId: undefined,
  };

  const getStatusStoreByTypeId = (typeId: StatusTypeId): StatusStoreByTypeId => ({
    getAll: fullStatusStore.getAll,
    set(statuses): void {
      universalStatusStore.setState((state) => {
        // Create a new state object to merge with the current state
        const newState = { ...state };

        // Process each status and merge it into the appropriate storyId record
        for (const status of statuses) {
          const { storyId } = status;
          if (status.typeId !== typeId) {
            // Validate that all statuses have the correct typeId
            switch (environment) {
              case 'server':
                throw new ServerStatusTypeIdMismatchError({
                  status,
                  typeId,
                });
              case 'manager':
                throw new ManagerStatusTypeIdMismatchError({
                  status,
                  typeId,
                });
              case 'preview':
              default:
                throw new PreviewStatusTypeIdMismatchError({
                  status,
                  typeId,
                });
            }
          }

          newState[storyId] = { ...(newState[storyId] ?? {}), [typeId]: status };
        }
        return newState;
      });
    },
    onAllStatusChange: fullStatusStore.onAllStatusChange,
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
          if (newState[storyId]?.[typeId] && (!storyIds || storyIds?.includes(storyId))) {
            const { [typeId]: omittedStatus, ...storyStatusesWithoutTypeId } = newState[storyId];
            newState[storyId] = storyStatusesWithoutTypeId;
          }
        }
        return newState;
      });
    },
    typeId,
  });

  if (!useUniversalStore) {
    return { getStatusStoreByTypeId, fullStatusStore, universalStatusStore };
  }

  return {
    getStatusStoreByTypeId,
    fullStatusStore,
    universalStatusStore,
    useStatusStore: <T = StatusesByStoryIdAndTypeId>(
      selector?: (statuses: StatusesByStoryIdAndTypeId) => T
    ) => useUniversalStore(universalStatusStore, selector as any)[0] as T,
  };
}
