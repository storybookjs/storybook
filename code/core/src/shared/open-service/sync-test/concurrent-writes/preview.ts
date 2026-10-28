import { registerService } from '@storybook/core/preview-api';

import { concurrentWritesSyncServiceDef } from './definition.ts';

export const concurrentWritesSyncService = registerService(concurrentWritesSyncServiceDef);
