import type { UniversalStore } from '../universal-store';
import type { StoreOptions } from '../universal-store/types';

export type ItemId = string;

export type ItemStatus = 'accepted' | 'done' | 'skipped';

export type StoreState = {
  loaded: boolean;
  muted: boolean | Array<ItemId>;
  values: Record<ItemId, ItemStatus>;
};

export type StoreEvent =
  | { type: 'accept'; payload: ItemId }
  | { type: 'done'; payload: ItemId }
  | { type: 'skip'; payload: ItemId }
  | { type: 'reset'; payload: ItemId }
  | { type: 'mute'; payload: boolean | Array<ItemId> };

export const UNIVERSAL_CHECKLIST_STORE_OPTIONS: StoreOptions<StoreState> = {
  id: 'storybook/checklist',
  initialState: {
    loaded: false,
    muted: false,
    values: {},
  } as StoreState,
} as const;

export type ChecklistStore = {
  accept: (id: ItemId) => void;
  done: (id: ItemId) => void;
  skip: (id: ItemId) => void;
  reset: (id: ItemId) => void;
  mute: (value: boolean | Array<ItemId>) => void;
};

export type ChecklistStoreEnvironment = 'server' | 'manager' | 'preview';

export const createChecklistStore = (
  universalChecklistStore: UniversalStore<StoreState, StoreEvent>
) => ({
  accept: (id: ItemId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      values: { ...state.values, [id]: 'accepted' },
    }));
  },
  done: (id: ItemId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      values: { ...state.values, [id]: 'done' },
    }));
  },
  skip: (id: ItemId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      values: { ...state.values, [id]: 'skipped' },
    }));
  },
  reset: (id: ItemId) => {
    universalChecklistStore.setState((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _, ...rest } = state.values;
      return { ...state, values: rest };
    });
  },
  mute: (value: boolean | Array<ItemId>) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      muted: Array.isArray(value)
        ? Array.from(
            new Set([...(Array.isArray(state.muted) ? state.muted : []), ...(value || [])])
          )
        : value,
    }));
  },
});
