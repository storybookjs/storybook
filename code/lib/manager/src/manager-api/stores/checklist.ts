import { whenChannelInstalled } from '@storybook/core/internal/channels';
import {
  type StoreEvent,
  type StoreState,
  createChecklistStore,
} from '@storybook/core/internal/deep/shared/checklist-store';
import { UNIVERSAL_CHECKLIST_STORE_OPTIONS } from '@storybook/core/internal/deep/shared/checklist-store';
import { UniversalStore } from '@storybook/core/internal/deep/shared/universal-store';

export const universalChecklistStore = UniversalStore.create<StoreState, StoreEvent>({
  ...UNIVERSAL_CHECKLIST_STORE_OPTIONS,
  // A static build has no server, so the manager owns the state.
  owner: globalThis.CONFIG_TYPE === 'PRODUCTION',
  channel: whenChannelInstalled(),
});

export const checklistStore = createChecklistStore(universalChecklistStore);
