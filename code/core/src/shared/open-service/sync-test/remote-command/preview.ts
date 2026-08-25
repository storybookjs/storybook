import { registerService } from 'storybook/preview-api';

import { remoteCommandSyncServiceDef } from './definition.ts';

export const remoteCommandSyncService = registerService(remoteCommandSyncServiceDef);
