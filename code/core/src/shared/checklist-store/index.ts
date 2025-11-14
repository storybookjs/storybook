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
