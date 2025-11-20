import type { globalSettings } from '../../cli/globalSettings';
import type { UniversalStore } from '../universal-store';
import type { StoreOptions } from '../universal-store/types';
import { initialState } from './checklistData.state';

export type StoreState = Required<
  Awaited<ReturnType<typeof globalSettings>>['value']['checklist'] & {
    loaded: boolean;
  }
>;

export type ItemId = string;
export type ItemState = StoreState['values'][ItemId];

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
    universalChecklistStore.getState().values[id] ?? { status: 'open', mutedAt: undefined },
  accept: (id: ItemId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      values: { ...state.values, [id]: { ...state.values[id], status: 'accepted' } },
    }));
  },
  done: (id: ItemId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      values: { ...state.values, [id]: { ...state.values[id], status: 'done' } },
    }));
  },
  skip: (id: ItemId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      values: { ...state.values, [id]: { ...state.values[id], status: 'skipped' } },
    }));
  },
  reset: (id: ItemId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      values: { ...state.values, [id]: { ...state.values[id], status: 'open' } },
    }));
  },
  mute: (itemIds: Array<ItemId>) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      values: itemIds.reduce(
        (acc, id) => ({ ...acc, [id]: { ...state.values[id], mutedAt: Date.now() } }),
        state.values
      ),
    }));
  },
  disable: (value: boolean) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      widget: { ...state.widget, disable: value },
      values: Object.entries(state.values).reduce(
        (acc, [id, value]) => ({ ...acc, [id]: { ...value, mutedAt: undefined } }),
        state.values
      ),
    }));
  },
});
