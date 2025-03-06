/* eslint-disable @typescript-eslint/naming-convention */
import {
  experimental_MockUniversalStore,
  experimental_useUniversalStore,
} from 'storybook/internal/manager-api';

import * as testUtils from '@storybook/test';

import { createStatusStore } from '../shared/status-store';
import { UNIVERSAL_STATUS_STORE_OPTIONS } from '../shared/status-store';

export const {
  fullStatusStore: internal_fullStatusStore,
  getStatusStoreByTypeId: experimental_getStatusStore,
  useStatusStore: experimental_useStatusStore,
} = createStatusStore({
  universalStatusStore: new experimental_MockUniversalStore(
    UNIVERSAL_STATUS_STORE_OPTIONS,
    testUtils
  ),
  useUniversalStore: experimental_useUniversalStore,
});
