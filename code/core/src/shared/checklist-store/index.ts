import type { globalSettings } from '../../cli/globalSettings';
import type { UniversalStore } from '../universal-store';
import type { StoreOptions } from '../universal-store/types';
import { initialState } from './checklistData.state';

/** ChecklistState is the persisted state, which may be incomplete */
export type ChecklistState = NonNullable<
  Awaited<ReturnType<typeof globalSettings>>['value']['checklist']
>;

/** Store uses initialState to ensure all items are present */
export type StoreState = Required<
  Omit<ChecklistState, 'items'> & {
    items: NonNullable<Required<ChecklistState['items']>>;
    loaded: boolean;
  }
>;

export type ItemId = keyof StoreState['items'];
export type ItemState = StoreState['items'][keyof StoreState['items']];

export type StoreEvent =
  | { type: 'accept'; payload: ItemId }
  | { type: 'done'; payload: ItemId }
  | { type: 'skip'; payload: ItemId }
  | { type: 'reset'; payload: ItemId }
  | { type: 'mute'; payload: Array<ItemId> }
  | { type: 'disable'; payload: boolean };

export const UNIVERSAL_CHECKLIST_STORE_OPTIONS: StoreOptions<StoreState> = {
  id: 'storybook/checklist',
  initialState,
} as const;

export type ChecklistStoreEnvironment = 'server' | 'manager' | 'preview';

export const createChecklistStore = (
  universalChecklistStore: UniversalStore<StoreState, StoreEvent>
) => ({
  getValue: (id: ItemId) =>
    universalChecklistStore.getState().items[id] ?? { status: 'open', mutedAt: undefined },
  accept: (id: ItemId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      items: { ...state.items, [id]: { ...state.items[id], status: 'accepted' } },
    }));
  },
  done: (id: ItemId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      items: { ...state.items, [id]: { ...state.items[id], status: 'done' } },
    }));
  },
  skip: (id: ItemId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      items: { ...state.items, [id]: { ...state.items[id], status: 'skipped' } },
    }));
  },
  reset: (id: ItemId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      items: { ...state.items, [id]: { ...state.items[id], status: 'open' } },
    }));
  },
  mute: (itemIds: Array<ItemId>) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      items: itemIds.reduce(
        (acc, id) => ({ ...acc, [id]: { ...state.items[id], mutedAt: Date.now() } }),
        state.items
      ),
    }));
  },
  disable: (value: boolean) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      widget: { ...state.widget, disable: value },
      items: Object.entries(state.items).reduce(
        (acc, [id, value]) => ({ ...acc, [id]: { ...value, mutedAt: undefined } }),
        state.items
      ),
    }));
  },
});
