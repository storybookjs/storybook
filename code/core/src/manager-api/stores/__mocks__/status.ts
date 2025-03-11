import * as testUtils from 'storybook/test';

import { createStatusStore } from '../../../shared/status-store';
import { UNIVERSAL_STATUS_STORE_OPTIONS } from '../../../shared/status-store';
import { useUniversalStore } from '../../../shared/universal-store/use-universal-store-manager';
import { experimental_MockUniversalStore } from '../../root';

const mockStatusStore = createStatusStore({
  universalStatusStore: new experimental_MockUniversalStore(
    UNIVERSAL_STATUS_STORE_OPTIONS,
    testUtils
  ),
  useUniversalStore,
  environment: 'manager',
});

export const { fullStatusStore, getStatusStoreByTypeId, useStatusStore } = mockStatusStore;
