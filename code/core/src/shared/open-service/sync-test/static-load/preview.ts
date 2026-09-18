import { registerService } from 'storybook/preview-api';

import { staticLoadSyncServiceDef } from './definition.ts';

export const staticLoadSyncService = registerService(staticLoadSyncServiceDef);
