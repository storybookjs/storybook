import {
  type StoreEvent,
  type StoreState,
  createChecklistStore,
} from '@storybook/core/internal/deep/shared/checklist-store';
import { UNIVERSAL_CHECKLIST_STORE_OPTIONS } from '@storybook/core/internal/deep/shared/checklist-store';
import { UniversalStore } from '@storybook/core/internal/deep/shared/universal-store';

export const mockUniversalChecklistStore = UniversalStore.create<StoreState, StoreEvent>({
  ...UNIVERSAL_CHECKLIST_STORE_OPTIONS,
});

export const checklistStore = createChecklistStore(mockUniversalChecklistStore);
