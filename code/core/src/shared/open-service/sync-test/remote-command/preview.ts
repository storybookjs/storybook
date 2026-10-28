import { registerService } from '@storybook/core/preview-api';

import { remoteCommandSyncServiceDef } from './definition.ts';

export const remoteCommandSyncService = registerService(remoteCommandSyncServiceDef);
