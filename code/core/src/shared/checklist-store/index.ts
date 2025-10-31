import type { UniversalStore } from '../universal-store';
import type { StoreOptions } from '../universal-store/types';

export type TaskId = string;

export type StoreState = {
  loaded: boolean;
  muted: boolean | Array<TaskId>;
  accepted: Array<TaskId>;
  done: Array<TaskId>;
  skipped: Array<TaskId>;
};

export type StoreEvent =
  | { type: 'accept'; payload: TaskId }
  | { type: 'done'; payload: TaskId }
  | { type: 'skip'; payload: TaskId }
  | { type: 'reset'; payload: TaskId }
  | { type: 'mute'; payload: boolean | Array<TaskId> };

export const UNIVERSAL_CHECKLIST_STORE_OPTIONS: StoreOptions<StoreState> = {
  id: 'storybook/checklist',
  initialState: {
    loaded: false,
    muted: false,
    accepted: [],
    done: [],
    skipped: [],
  } as StoreState,
} as const;

export type ChecklistStore = {
  accept: (id: TaskId) => void;
  done: (id: TaskId) => void;
  skip: (id: TaskId) => void;
  reset: (id: TaskId) => void;
  mute: (value: boolean | Array<TaskId>) => void;
};

export type ChecklistStoreEnvironment = 'server' | 'manager' | 'preview';

export const createChecklistStore = (
  universalStore: UniversalStore<StoreState, StoreEvent>
): ChecklistStore => ({
  accept: (id: TaskId) => {
    universalStore.setState((state) => ({
      ...state,
      accepted: state.accepted.includes(id) ? state.accepted : [...state.accepted, id],
      skipped: state.skipped.filter((v) => v !== id),
    }));
  },
  done: (id: TaskId) => {
    universalStore.setState((state) => ({
      ...state,
      done: state.done.includes(id) ? state.done : [...state.done, id],
      skipped: state.skipped.filter((v) => v !== id),
    }));
  },
  skip: (id: TaskId) => {
    universalStore.setState((state) => ({
      ...state,
      accepted: state.accepted.filter((v) => v !== id),
      skipped: state.skipped.includes(id) ? state.skipped : [...state.skipped, id],
    }));
  },
  reset: (id: TaskId) => {
    universalStore.setState((state) => ({
      ...state,
      accepted: state.accepted.filter((v) => v !== id),
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
