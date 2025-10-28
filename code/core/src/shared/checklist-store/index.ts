import type { UniversalStore } from '../universal-store';
import type { StoreOptions } from '../universal-store/types';

export type TaskId = string;

export type StoreState = {
  loaded: boolean;
  muted: boolean | Array<TaskId>;
  completed: Array<TaskId>;
  skipped: Array<TaskId>;
};

export type StoreEvent =
  | { type: 'complete'; payload: TaskId }
  | { type: 'skip'; payload: TaskId }
  | { type: 'reset'; payload: TaskId }
  | { type: 'mute'; payload: boolean | Array<TaskId> };

export const UNIVERSAL_CHECKLIST_STORE_OPTIONS: StoreOptions<StoreState> = {
  id: 'storybook/checklist',
  initialState: {
    loaded: false,
    muted: false,
    completed: [],
    skipped: [],
  } as StoreState,
} as const;

export type ChecklistStore = {
  complete: (id: TaskId) => void;
  skip: (id: TaskId) => void;
  reset: (id: TaskId) => void;
  mute: (value: boolean | Array<TaskId>) => void;
};

export type ChecklistStoreEnvironment = 'server' | 'manager' | 'preview';

export const createChecklistStore = (
  universalStore: UniversalStore<StoreState, StoreEvent>
): ChecklistStore => ({
  complete: (id: TaskId) => {
    universalStore.setState((state) => ({
      ...state,
      completed: state.completed.includes(id) ? state.completed : [...state.completed, id],
      skipped: state.skipped.filter((v) => v !== id),
    }));
  },
  skip: (id: TaskId) => {
    universalStore.setState((state) => ({
      ...state,
      completed: state.completed.filter((v) => v !== id),
      skipped: state.skipped.includes(id) ? state.skipped : [...state.skipped, id],
    }));
  },
  reset: (id: TaskId) => {
    universalStore.setState((state) => ({
      ...state,
      completed: state.completed.filter((v) => v !== id),
      skipped: state.skipped.filter((v) => v !== id),
    }));
  },
  mute: (value: boolean | Array<TaskId>) => {
    universalStore.setState((state) => ({
      ...state,
      muted: Array.isArray(value)
        ? Array.from(
            new Set([...(Array.isArray(state.muted) ? state.muted : []), ...(value || [])])
          )
        : value,
    }));
  },
});
