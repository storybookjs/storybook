import type { UniversalStore } from '../universal-store';
import type { StoreOptions } from '../universal-store/types';

export type TaskId = string;

export type StoreState = {
  completed: Array<TaskId>;
  skipped: Array<TaskId>;
};

export type StoreEvent =
  | { type: 'complete'; payload: TaskId }
  | { type: 'skip'; payload: TaskId }
  | { type: 'reset'; payload: TaskId };

export const UNIVERSAL_CHECKLIST_STORE_OPTIONS: StoreOptions<StoreState> = {
  id: 'storybook/checklist',
  initialState: { completed: ['add-component'], skipped: [] } as StoreState,
} as const;

export type ChecklistStore = {
  complete: (id: TaskId) => void;
  skip: (id: TaskId) => void;
  reset: (id: TaskId) => void;
};

export type ChecklistStoreEnvironment = 'server' | 'manager' | 'preview';

export const createChecklistStore = (
  universalStore: UniversalStore<StoreState, StoreEvent>
): ChecklistStore => ({
  complete: (id: TaskId) => {
    universalStore.setState((state) => ({
      completed: state.completed.includes(id) ? state.completed : [...state.completed, id],
      skipped: state.skipped.filter((v) => v !== id),
    }));
  },
  skip: (id: TaskId) => {
    universalStore.setState((state) => ({
      completed: state.completed.filter((v) => v !== id),
      skipped: state.skipped.includes(id) ? state.skipped : [...state.skipped, id],
    }));
  },
  reset: (id: TaskId) => {
    universalStore.setState((state) => ({
      completed: state.completed.filter((v) => v !== id),
      skipped: state.skipped.filter((v) => v !== id),
    }));
  },
});
