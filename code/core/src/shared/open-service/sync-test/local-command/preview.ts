import { registerService } from 'storybook/preview-api';

import { localCommandSyncServiceDef } from './definition.ts';

export const localCommandSyncService = registerService(localCommandSyncServiceDef);
