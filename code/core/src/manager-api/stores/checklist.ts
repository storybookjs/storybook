import { experimental_UniversalStore } from '..';
import type { ChecklistStore } from '../../shared/checklist-store';
import { type StoreEvent, type StoreState, type TaskId } from '../../shared/checklist-store';
import { UNIVERSAL_CHECKLIST_STORE_OPTIONS } from '../../shared/checklist-store';

export const universalChecklistStore = experimental_UniversalStore.create<StoreState, StoreEvent>({
  ...UNIVERSAL_CHECKLIST_STORE_OPTIONS,
  leader: globalThis.CONFIG_TYPE === 'PRODUCTION',
});

export const checklistStore: ChecklistStore = {
  accept: (id: TaskId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      accepted: state.accepted.includes(id) ? state.accepted : [...state.accepted, id],
      skipped: state.skipped.filter((v) => v !== id),
    }));
  },
  done: (id: TaskId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      done: state.done.includes(id) ? state.done : [...state.done, id],
      skipped: state.skipped.filter((v) => v !== id),
    }));
  },
  skip: (id: TaskId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      accepted: state.accepted.filter((v) => v !== id),
      skipped: state.skipped.includes(id) ? state.skipped : [...state.skipped, id],
    }));
  },
  reset: (id: TaskId) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      accepted: state.accepted.filter((v) => v !== id),
      skipped: state.skipped.filter((v) => v !== id),
    }));
  },
  mute: (value: boolean | Array<TaskId>) => {
    universalChecklistStore.setState((state) => ({
      ...state,
      muted: Array.isArray(value)
        ? Array.from(
            new Set([...(Array.isArray(state.muted) ? state.muted : []), ...(value || [])])
          )
        : value,
    }));
  },
};
