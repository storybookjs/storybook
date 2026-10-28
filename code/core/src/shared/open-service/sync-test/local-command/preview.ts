import { registerService } from '@storybook/core/preview-api';

import { localCommandSyncServiceDef } from './definition.ts';

export const localCommandSyncService = registerService(localCommandSyncServiceDef);
