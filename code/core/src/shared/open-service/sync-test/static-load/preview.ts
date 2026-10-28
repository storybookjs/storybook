import { registerService } from '@storybook/core/preview-api';

import { staticLoadSyncServiceDef } from './definition.ts';

export const staticLoadSyncService = registerService(staticLoadSyncServiceDef);
